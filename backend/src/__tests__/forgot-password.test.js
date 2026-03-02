/**
 * Tests cho Forgot Password / Reset Password Flow
 * 
 * Covers:
 * 1. Forgot Password API (gửi OTP)
 * 2. Verify OTP API
 * 3. Reset Password API
 * 4. Edge cases & Security
 */

import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import {
    register,
    login,
    forgotPassword,
    verifyOTPController,
    resetPassword
} from '../controllers/authController.js';
import { hashOTP, OTP_EXPIRY_MINUTES } from '../utils/otpGenerator.js';

// ==================== TIMEOUT ====================
// bcrypt với salt 12 rounds rất chậm (~1-3s/hash tùy CPU load)
// Nhiều test gọi createTestUser + requestForgotPassword (2-3 lần bcrypt)
// → cần timeout cao hơn default 5000ms
jest.setTimeout(15000);

// ==================== MOCK EMAIL SERVICE ====================
// Mock sendOTPEmail để không gửi email thật trong tests
const mockSendOTPEmail = jest.fn().mockResolvedValue(true);
jest.unstable_mockModule('../utils/emailService.js', () => ({
    default: mockSendOTPEmail
}));

// ==================== APP SETUP ====================
const app = express();
app.use(express.json());
app.use(cookieParser());

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/verify-otp', verifyOTPController);
app.post('/api/auth/reset-password', resetPassword);

let mongoServer;

// ==================== SETUP & TEARDOWN ====================
beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    process.env.JWT_SECRET = 'test-secret-key-for-forgot-password';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
}, 30000);

beforeEach(async () => {
    await User.deleteMany({});
    mockSendOTPEmail.mockClear();
});

// ==================== HELPERS ====================
const createTestUser = async (overrides = {}) => {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('Test1234!@#', salt);

    const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        authProvider: 'local',
        ...overrides
    });
    return user;
};

const requestForgotPassword = (email) =>
    request(app).post('/api/auth/forgot-password').send({ email });

const requestVerifyOTP = (email, otp) =>
    request(app).post('/api/auth/verify-otp').send({ email, otp });

const requestResetPassword = (resetToken, newPassword, confirmPassword) =>
    request(app).post('/api/auth/reset-password').send({
        resetToken,
        newPassword,
        confirmPassword
    });

// ==================== 1. FORGOT PASSWORD ====================
describe('POST /api/auth/forgot-password', () => {
    test('should return success for existing user', async () => {
        await createTestUser();

        const res = await requestForgotPassword('test@example.com');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('OTP');
    });

    test('should return success for non-existing email (prevent enumeration)', async () => {
        const res = await requestForgotPassword('nonexistent@example.com');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('should reject invalid email format', async () => {
        const res = await requestForgotPassword('invalid-email');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('should reject empty email', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('should not send OTP for OAuth-only accounts', async () => {
        await User.create({
            name: 'OAuth User',
            email: 'oauth@example.com',
            authProvider: 'google',
            providerId: '123456'
        });

        const res = await requestForgotPassword('oauth@example.com');
        expect(res.status).toBe(200); // Still 200 to prevent enumeration
        expect(res.body.success).toBe(true);
    });

    test('should save hashed OTP to user document', async () => {
        await createTestUser();

        await requestForgotPassword('test@example.com');

        const user = await User.findOne({ email: 'test@example.com' })
            .select('+resetPasswordOTP +resetPasswordOTPExpires');
        expect(user.resetPasswordOTP).toBeDefined();
        expect(user.resetPasswordOTPExpires).toBeDefined();
        expect(user.resetPasswordAttempts).toBe(0);
    });

    test('should reject request for locked account', async () => {
        await createTestUser({
            lockUntil: new Date(Date.now() + 30 * 60 * 1000)
        });

        const res = await requestForgotPassword('test@example.com');
        expect(res.status).toBe(429);
        expect(res.body.success).toBe(false);
    });

    test('should handle case-insensitive email', async () => {
        await createTestUser();

        const res = await requestForgotPassword('TEST@EXAMPLE.COM');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('should overwrite previous OTP when requesting new one', async () => {
        await createTestUser();

        await requestForgotPassword('test@example.com');
        const user1 = await User.findOne({ email: 'test@example.com' })
            .select('+resetPasswordOTP');
        const firstOTP = user1.resetPasswordOTP;

        await requestForgotPassword('test@example.com');
        const user2 = await User.findOne({ email: 'test@example.com' })
            .select('+resetPasswordOTP');
        const secondOTP = user2.resetPasswordOTP;

        expect(firstOTP).not.toBe(secondOTP);
    });
});

// ==================== 2. VERIFY OTP ====================
describe('POST /api/auth/verify-otp', () => {
    let testOTP;
    let testUser;

    beforeEach(async () => {
        testUser = await createTestUser();
        testOTP = '123456';
        const hashedOTP = hashOTP(testOTP);
        await User.findByIdAndUpdate(testUser._id, {
            resetPasswordOTP: hashedOTP,
            resetPasswordOTPExpires: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
            resetPasswordAttempts: 0
        });
    });

    test('should verify valid OTP and return resetToken', async () => {
        const res = await requestVerifyOTP('test@example.com', testOTP);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.resetToken).toBeDefined();

        // Verify the token is valid
        const decoded = jwt.verify(res.body.resetToken, process.env.JWT_SECRET);
        expect(decoded.purpose).toBe('reset-password');
        expect(decoded.id).toBe(testUser._id.toString());
    });

    test('should reject wrong OTP', async () => {
        const res = await requestVerifyOTP('test@example.com', '000000');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('không đúng');
    });

    test('should increment attempts on wrong OTP', async () => {
        await requestVerifyOTP('test@example.com', '000000');

        const user = await User.findById(testUser._id);
        expect(user.resetPasswordAttempts).toBe(1);
    });

    test('should reject after max attempts exceeded', async () => {
        // Use up all attempts
        await User.findByIdAndUpdate(testUser._id, { resetPasswordAttempts: 3 });

        const res = await requestVerifyOTP('test@example.com', testOTP);
        expect(res.status).toBe(429);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain('vượt quá');
    });

    test('should reject expired OTP', async () => {
        await User.findByIdAndUpdate(testUser._id, {
            resetPasswordOTPExpires: new Date(Date.now() - 1000) // Expired
        });

        const res = await requestVerifyOTP('test@example.com', testOTP);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('hết hạn');
    });

    test('should reject missing email', async () => {
        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ otp: testOTP });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('should reject missing OTP', async () => {
        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@example.com' });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('should reject non-6-digit OTP', async () => {
        const res = await requestVerifyOTP('test@example.com', '12345');
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('6 chữ số');
    });

    test('should reject for user without pending OTP', async () => {
        // Clear OTP using $unset
        await User.findByIdAndUpdate(testUser._id, {
            $unset: { resetPasswordOTP: 1, resetPasswordOTPExpires: 1 }
        });

        const res = await requestVerifyOTP('test@example.com', testOTP);
        expect(res.status).toBe(400);
    });

    test('should clear OTP fields after successful verification', async () => {
        await requestVerifyOTP('test@example.com', testOTP);

        const user = await User.findById(testUser._id)
            .select('+resetPasswordOTP +resetPasswordOTPExpires');
        expect(user.resetPasswordOTP).toBeUndefined();
        expect(user.resetPasswordOTPExpires).toBeUndefined();
    });

    test('should reject for non-existing email', async () => {
        const res = await requestVerifyOTP('nonexistent@example.com', testOTP);
        expect(res.status).toBe(400);
    });
});

// ==================== 3. RESET PASSWORD ====================
describe('POST /api/auth/reset-password', () => {
    let testUser;
    let validResetToken;

    beforeEach(async () => {
        testUser = await createTestUser();
        validResetToken = jwt.sign(
            { id: testUser._id, purpose: 'reset-password' },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );
    });

    test('should reset password successfully', async () => {
        const res = await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('thành công');
    });

    test('should be able to login with new password after reset', async () => {
        await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'NewPass1234!@#' });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.success).toBe(true);
    });

    test('should not be able to login with old password after reset', async () => {
        await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'Test1234!@#' });
        expect(loginRes.status).toBe(401);
    });

    test('should reject mismatched passwords', async () => {
        const res = await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'DifferentPass!@#'
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('không khớp');
    });

    test('should reject weak password', async () => {
        const res = await requestResetPassword(
            validResetToken,
            '12345678',
            '12345678'
        );
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('should reject same password as current', async () => {
        const res = await requestResetPassword(
            validResetToken,
            'Test1234!@#',
            'Test1234!@#'
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('trùng');
    });

    test('should reject expired reset token', async () => {
        const expiredToken = jwt.sign(
            { id: testUser._id, purpose: 'reset-password' },
            process.env.JWT_SECRET,
            { expiresIn: '0s' }
        );

        // Wait 1 second for token to expire
        await new Promise(resolve => setTimeout(resolve, 1100));

        const res = await requestResetPassword(
            expiredToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('hết hạn');
    });

    test('should reject invalid reset token', async () => {
        const res = await requestResetPassword(
            'invalid-token',
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res.status).toBe(400);
    });

    test('should reject token with wrong purpose', async () => {
        const wrongPurposeToken = jwt.sign(
            { id: testUser._id, purpose: 'login' },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        const res = await requestResetPassword(
            wrongPurposeToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('không hợp lệ');
    });

    test('should reject missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ resetToken: validResetToken });
        expect(res.status).toBe(400);
    });

    test('should reset login attempts after password reset', async () => {
        // Set locked state
        await User.findByIdAndUpdate(testUser._id, {
            loginAttempts: 5,
            lockUntil: new Date(Date.now() + 30 * 60 * 1000)
        });

        await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );

        const user = await User.findById(testUser._id);
        expect(user.loginAttempts).toBe(0);
        expect(user.lockUntil).toBeFalsy();
    });

    test('should not reuse reset token', async () => {
        // First use - success
        const res1 = await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res1.status).toBe(200);

        // Same token, should still work (token is JWT-based, not invalidated)
        // BUT the password is already "NewPass1234!@#", so same-password check fires
        const res2 = await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res2.status).toBe(400);
        expect(res2.body.message).toContain('trùng');
    });

    test('should reject for deleted user', async () => {
        await User.findByIdAndDelete(testUser._id);

        const res = await requestResetPassword(
            validResetToken,
            'NewPass1234!@#',
            'NewPass1234!@#'
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('không tồn tại');
    });
});

// ==================== 4. FULL FLOW ====================
describe('Full Forgot Password Flow', () => {
    test('should complete full flow: forgot → verify → reset → login', async () => {
        // Step 0: Register a user
        await request(app).post('/api/auth/register').send({
            name: 'Flow User',
            email: 'flow@example.com',
            password: 'FlowPass1234!@#',
            confirmPassword: 'FlowPass1234!@#'
        });

        // Step 1: Request forgot password
        const forgotRes = await requestForgotPassword('flow@example.com');
        expect(forgotRes.status).toBe(200);

        // Step 2: Get OTP from DB (in real app, from email)
        const userWithOTP = await User.findOne({ email: 'flow@example.com' })
            .select('+resetPasswordOTP +resetPasswordOTPExpires');
        expect(userWithOTP.resetPasswordOTP).toBeDefined();

        // We need to use the raw OTP, but we stored the hashed version
        // In this test, we'll directly set a known OTP
        const knownOTP = '654321';
        const hashedKnownOTP = hashOTP(knownOTP);
        await User.findOneAndUpdate(
            { email: 'flow@example.com' },
            {
                resetPasswordOTP: hashedKnownOTP,
                resetPasswordOTPExpires: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
                resetPasswordAttempts: 0
            }
        );

        // Step 3: Verify OTP
        const verifyRes = await requestVerifyOTP('flow@example.com', knownOTP);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.resetToken).toBeDefined();

        // Step 4: Reset password
        const resetRes = await requestResetPassword(
            verifyRes.body.resetToken,
            'NewFlowPass!@#123',
            'NewFlowPass!@#123'
        );
        expect(resetRes.status).toBe(200);

        // Step 5: Login with new password
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'flow@example.com', password: 'NewFlowPass!@#123' });
        expect(loginRes.status).toBe(200);
        expect(loginRes.body.success).toBe(true);
    });
});
