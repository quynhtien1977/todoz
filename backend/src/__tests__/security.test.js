/**
 * Security Hardening Tests
 * 
 * Covers:
 * 1. Account Lockout (brute force protection)
 * 2. XSS Sanitization
 * 3. Password Strength on Change Password
 * 4. Security Audit Logging
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
import Task from '../models/Task.js';
import { register, login, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { sanitizeRequest, stripHtmlTags, sanitizeValue } from '../middleware/xssSanitizer.js';
import { logSecurityEvent } from '../utils/securityLogger.js';

// ==================== APP SETUP ====================
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(sanitizeRequest);

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.put('/api/auth/change-password', protect, changePassword);

// Test routes for sanitization
app.post('/api/test/echo', (req, res) => {
    res.json(req.body);
});
app.get('/api/test/echo-query', (req, res) => {
    res.json(req.query);
});

let mongoServer;

// ==================== SETUP & TEARDOWN ====================
beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
}, 15000);

beforeEach(async () => {
    await User.deleteMany({});
    await Task.deleteMany({});
});

// ==================== HELPERS ====================
const createTestUser = async (overrides = {}) => {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('password123', salt);
    return User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: hashedPassword,
        authProvider: 'local',
        ...overrides
    });
};

const generateTestToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ================================================================
// 1. ACCOUNT LOCKOUT TESTS
// ================================================================
describe('Account Lockout', () => {
    beforeEach(async () => {
        await createTestUser();
    });

    test('should track failed login attempts', async () => {
        // 1st failed attempt
        await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpass1' });

        const user = await User.findOne({ email: 'test@example.com' }).select('+loginAttempts');
        expect(user.loginAttempts).toBe(1);
    });

    test('should return attemptsLeft on failed login', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpass1' });

        expect(res.status).toBe(401);
        expect(res.body.attemptsLeft).toBe(9); // 10 max - 1 attempt = 9 left
    });

    test('should increment attempts on each failed login', async () => {
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpass1' });
        }

        const user = await User.findOne({ email: 'test@example.com' }).select('+loginAttempts');
        expect(user.loginAttempts).toBe(3);
    });

    test('should lock account after 10 failed attempts', async () => {
        // 10 failed attempts
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpass1' });
        }

        // 11th attempt should be locked
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(423); // Locked
        expect(res.body.message).toContain('khóa');
        expect(res.body.remainingMinutes).toBeDefined();
    });

    test('should return 423 with lockUntil when account is locked', async () => {
        // Lock the account
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpass1' });
        }

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(423);
        expect(res.body.lockUntil).toBeDefined();
        expect(res.body.remainingMinutes).toBeGreaterThan(0);
    });

    test('should reset attempts on successful login', async () => {
        // 3 failed attempts
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpass1' });
        }

        // Successful login
        await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        const user = await User.findOne({ email: 'test@example.com' }).select('+loginAttempts +lockUntil');
        expect(user.loginAttempts).toBe(0);
        expect(user.lockUntil).toBeNull();
    });

    test('should unlock account after lock time expires', async () => {
        // Lock the account
        const user = await User.findOne({ email: 'test@example.com' });
        user.loginAttempts = 5;
        user.lockUntil = new Date(Date.now() - 1000); // Already expired
        await user.save({ validateBeforeSave: false });

        // Login with correct password should work
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('should not lock when lockUntil is expired and new attempt is correct', async () => {
        // Set expired lock
        const user = await User.findOne({ email: 'test@example.com' });
        user.loginAttempts = 5;
        user.lockUntil = new Date(Date.now() - 60000); // Expired 1 min ago
        await user.save({ validateBeforeSave: false });

        // Correct login should succeed and reset counters
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(200);

        const updatedUser = await User.findOne({ email: 'test@example.com' }).select('+loginAttempts +lockUntil');
        expect(updatedUser.loginAttempts).toBe(0);
        expect(updatedUser.lockUntil).toBeNull();
    });

    test('should block login even with correct password when account is locked', async () => {
        // Lock the account with future lockUntil
        const user = await User.findOne({ email: 'test@example.com' });
        user.loginAttempts = 5;
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Locked 30 min
        await user.save({ validateBeforeSave: false });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(res.status).toBe(423);
    });
});

// ================================================================
// 2. XSS SANITIZATION TESTS
// ================================================================
describe('XSS Sanitization', () => {
    describe('stripHtmlTags', () => {
        test('should strip script tags and content', () => {
            const input = 'Hello <script>alert("xss")</script> World';
            expect(stripHtmlTags(input)).toBe('Hello  World');
        });

        test('should strip HTML tags', () => {
            expect(stripHtmlTags('<b>bold</b>')).toBe('bold');
            expect(stripHtmlTags('<p>paragraph</p>')).toBe('paragraph');
            expect(stripHtmlTags('<div class="test">content</div>')).toBe('content');
        });

        test('should strip event handlers', () => {
            const input = '<img onerror="alert(1)" src="x">';
            const result = stripHtmlTags(input);
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        test('should strip javascript: protocol', () => {
            expect(stripHtmlTags('javascript:alert(1)')).not.toContain('javascript:');
        });

        test('should preserve normal text', () => {
            expect(stripHtmlTags('Hello World')).toBe('Hello World');
            expect(stripHtmlTags('Công việc hôm nay')).toBe('Công việc hôm nay');
            expect(stripHtmlTags('Task #1 - Important!')).toBe('Task #1 - Important!');
        });

        test('should preserve special characters', () => {
            expect(stripHtmlTags('Price: $100 & discount 20%')).toBe('Price: $100 & discount 20%');
            expect(stripHtmlTags('email@test.com')).toBe('email@test.com');
        });

        test('should handle non-string input', () => {
            expect(stripHtmlTags(123)).toBe(123);
            expect(stripHtmlTags(null)).toBe(null);
            expect(stripHtmlTags(undefined)).toBe(undefined);
        });

        test('should handle empty string', () => {
            expect(stripHtmlTags('')).toBe('');
        });
    });

    describe('sanitizeValue', () => {
        test('should sanitize nested object', () => {
            const input = {
                title: '<script>alert("xss")</script>Task',
                description: '<b>bold</b> text'
            };
            const result = sanitizeValue(input);
            expect(result.title).toBe('Task');
            expect(result.description).toBe('bold text');
        });

        test('should sanitize arrays', () => {
            const input = ['<script>x</script>clean', 'normal'];
            const result = sanitizeValue(input);
            expect(result[0]).toBe('clean');
            expect(result[1]).toBe('normal');
        });

        test('should NOT sanitize password fields', () => {
            const input = {
                email: 'test@example.com',
                password: '<script>p@ss123</script>',
                confirmPassword: '<script>p@ss123</script>',
                currentPassword: '<script>old123</script>',
                newPassword: '<script>new123</script>'
            };
            const result = sanitizeValue(input);
            expect(result.password).toBe('<script>p@ss123</script>');
            expect(result.confirmPassword).toBe('<script>p@ss123</script>');
            expect(result.currentPassword).toBe('<script>old123</script>');
            expect(result.newPassword).toBe('<script>new123</script>');
        });
    });

    describe('sanitizeRequest middleware', () => {
        test('should sanitize request body', async () => {
            const res = await request(app)
                .post('/api/test/echo')
                .send({
                    title: '<script>alert("xss")</script>Clean Title',
                    description: '<b>Bold</b> text'
                });

            expect(res.body.title).toBe('Clean Title');
            expect(res.body.description).toBe('Bold text');
        });

        test('should sanitize nested objects in request', async () => {
            const res = await request(app)
                .post('/api/test/echo')
                .send({
                    task: {
                        title: '<img onerror="alert(1)">Task',
                        notes: 'Normal notes'
                    }
                });

            expect(res.body.task.title).not.toContain('onerror');
            expect(res.body.task.notes).toBe('Normal notes');
        });

        test('should sanitize query parameters', async () => {
            const res = await request(app)
                .get('/api/test/echo-query')
                .query({ search: '<script>alert("xss")</script>hello' });

            expect(res.body.search).toBe('hello');
            expect(res.body.search).not.toContain('<script>');
        });

        test('should not break registration with clean data', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Nguyễn Văn An',
                    email: 'nguyenvanan@example.com',
                    password: 'password123',
                    confirmPassword: 'password123'
                });

            expect(res.status).toBe(201);
            expect(res.body.user.name).toBe('Nguyễn Văn An');
        });

        test('should strip XSS from registration name', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: '<script>alert(1)</script>Hacker',
                    email: 'hacker@example.com',
                    password: 'password123',
                    confirmPassword: 'password123'
                });

            // Name gets sanitized - check the resulting name
            if (res.status === 201) {
                expect(res.body.user.name).not.toContain('<script>');
            }
        });
    });
});

// ================================================================
// 3. CHANGE PASSWORD STRENGTH TESTS
// ================================================================
describe('Change Password - Security Enhancements', () => {
    let user, token;

    beforeEach(async () => {
        user = await createTestUser();
        token = generateTestToken(user._id);
    });

    test('should reject weak new password (no numbers)', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'abcdefgh',
                confirmPassword: 'abcdefgh'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('ít nhất 6 ký tự');
    });

    test('should reject weak new password (no letters)', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: '123456',
                confirmPassword: '123456'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('ít nhất 6 ký tự');
    });

    test('should reject short new password', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'ab1',
                confirmPassword: 'ab1'
            });

        expect(res.status).toBe(400);
    });

    test('should reject new password same as current', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'password123',
                confirmPassword: 'password123'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('khác mật khẩu hiện tại');
    });

    test('should accept strong new password', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'newStrongPass456',
                confirmPassword: 'newStrongPass456'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ================================================================
// 4. SECURITY AUDIT LOGGING TESTS
// ================================================================
describe('Security Audit Logging', () => {
    test('should create log entry with correct structure', () => {
        const mockReq = {
            ip: '127.0.0.1',
            get: (header) => header === 'user-agent' ? 'Mozilla/5.0 Test' : null,
            method: 'POST',
            originalUrl: '/api/auth/login',
            connection: {}
        };

        const entry = logSecurityEvent('LOGIN_SUCCESS', { email: 'test@example.com' }, mockReq);

        expect(entry.event).toBe('LOGIN_SUCCESS');
        expect(entry.level).toBe('INFO');
        expect(entry.email).toBe('test@example.com');
        expect(entry.ip).toBe('127.0.0.1');
        expect(entry.userAgent).toBe('Mozilla/5.0 Test');
        expect(entry.timestamp).toBeDefined();
    });

    test('should set correct log levels', () => {
        const loginSuccess = logSecurityEvent('LOGIN_SUCCESS', {});
        expect(loginSuccess.level).toBe('INFO');

        const loginFailed = logSecurityEvent('LOGIN_FAILED', {});
        expect(loginFailed.level).toBe('WARN');

        const accountLocked = logSecurityEvent('ACCOUNT_LOCKED', {});
        expect(accountLocked.level).toBe('WARN');

        const passwordChanged = logSecurityEvent('PASSWORD_CHANGED', {});
        expect(passwordChanged.level).toBe('INFO');
    });

    test('should handle missing req gracefully', () => {
        const entry = logSecurityEvent('LOGOUT', { userId: '123' });

        expect(entry.event).toBe('LOGOUT');
        expect(entry.userId).toBe('123');
        expect(entry.ip).toBeUndefined();
    });

    test('should log on successful login', async () => {
        await createTestUser();
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });

        const securityLogs = consoleSpy.mock.calls.filter(call =>
            typeof call[0] === 'string' && call[0].includes('[SECURITY]')
        );
        expect(securityLogs.length).toBeGreaterThan(0);

        const logStr = securityLogs[securityLogs.length - 1][0];
        expect(logStr).toContain('LOGIN_SUCCESS');

        consoleSpy.mockRestore();
    });

    test('should log on failed login', async () => {
        await createTestUser();
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpass1' });

        const securityLogs = consoleSpy.mock.calls.filter(call =>
            typeof call[0] === 'string' && call[0].includes('[SECURITY]')
        );
        expect(securityLogs.length).toBeGreaterThan(0);

        const logStr = securityLogs[securityLogs.length - 1][0];
        expect(logStr).toContain('LOGIN_FAILED');

        consoleSpy.mockRestore();
    });

    test('should log on account lockout', async () => {
        await createTestUser();
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

        // 10 failed attempts to trigger lockout
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpass1' });
        }

        const securityLogs = consoleSpy.mock.calls.filter(call =>
            typeof call[0] === 'string' && call[0].includes('ACCOUNT_LOCKED')
        );
        expect(securityLogs.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
    });

    test('should log on registration', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'New User',
                email: 'newuser@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        const securityLogs = consoleSpy.mock.calls.filter(call =>
            typeof call[0] === 'string' && call[0].includes('REGISTER')
        );
        expect(securityLogs.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
    });

    test('should log on password change', async () => {
        const user = await createTestUser();
        const token = generateTestToken(user._id);
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'newpass456',
                confirmPassword: 'newpass456'
            });

        const securityLogs = consoleSpy.mock.calls.filter(call =>
            typeof call[0] === 'string' && call[0].includes('PASSWORD_CHANGED')
        );
        expect(securityLogs.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
    });
});

// ================================================================
// 5. COMBINED SECURITY FLOW
// ================================================================
describe('Combined Security Flow', () => {
    test('Lockout → Wait → Login successfully', async () => {
        await createTestUser();

        // Lock the account
        for (let i = 0; i < 10; i++) {
            await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrong1' });
        }

        // Verify locked
        const lockedRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });
        expect(lockedRes.status).toBe(423);

        // Simulate lock expiry
        await User.updateOne(
            { email: 'test@example.com' },
            { lockUntil: new Date(Date.now() - 1000) }
        );

        // Login should succeed now
        const unlockRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' });
        expect(unlockRes.status).toBe(200);
    });

    test('XSS in task title should be sanitized through API', async () => {
        const res = await request(app)
            .post('/api/test/echo')
            .send({
                title: '<script>document.cookie</script>Do homework',
                priority: 'high'
            });

        expect(res.body.title).toBe('Do homework');
        expect(res.body.title).not.toContain('<script>');
        expect(res.body.priority).toBe('high');
    });
});
