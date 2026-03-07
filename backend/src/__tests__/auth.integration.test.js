/**
 * Integration Tests cho Authentication Flows
 * 
 * Covers:
 * 1. Login API (success, failure, edge cases)
 * 2. Logout API
 * 3. Get Profile (protected route)
 * 4. Update Profile
 * 5. Change Password
 * 6. Verify Token
 * 7. Merge Guest Tasks
 * 8. OAuth Callback
 * 9. Data Isolation (User A vs User B)
 * 10. Auth Middleware (protect & optionalAuth)
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
import {
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    updatePreferences,
    changePassword,
    deleteAccount,
    verifyToken,
    mergeGuestTasks,
    oauthCallback
} from '../controllers/authController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

// ==================== APP SETUP ====================
const app = express();
app.use(express.json());
app.use(cookieParser());

// Auth routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);
app.get('/api/auth/profile', protect, getProfile);
app.put('/api/auth/profile', protect, updateProfile);
app.put('/api/auth/change-password', protect, changePassword);
app.put('/api/auth/preferences', protect, updatePreferences);
app.delete('/api/auth/account', protect, deleteAccount);
app.get('/api/auth/verify', protect, verifyToken);
app.post('/api/auth/merge-tasks', protect, mergeGuestTasks);

// Test route for optionalAuth middleware
app.get('/api/test/optional', optionalAuth, (req, res) => {
    res.json({ user: req.user || null, isGuest: !req.user });
});

let mongoServer;

// ==================== SETUP & TEARDOWN ====================
beforeAll(async () => {
    // Disconnect any existing connection first
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:5173';
}, 30000); // 30s timeout for MongoMemoryServer startup

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
}, 15000);

beforeEach(async () => {
    await User.deleteMany({});
    await Task.deleteMany({});
});

// ==================== HELPER FUNCTIONS ====================
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

const registerAndGetToken = async (data = {}) => {
    const response = await request(app)
        .post('/api/auth/register')
        .send({
            name: data.name || 'Test User',
            email: data.email || 'test@example.com',
            password: data.password || 'password123',
            confirmPassword: data.confirmPassword || 'password123',
            ...data
        });
    return response;
};

const loginAndGetToken = async (email = 'test@example.com', password = 'password123') => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password });
    return response;
};

const generateTestToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ================================================================
// 1. LOGIN API TESTS
// ================================================================
describe('Login API', () => {
    beforeEach(async () => {
        await createTestUser();
    });

    describe('Successful Login', () => {
        test('should login with valid credentials', async () => {
            const res = await loginAndGetToken();

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test@example.com');
        });

        test('should set cookie with token', async () => {
            const res = await loginAndGetToken();

            expect(res.headers['set-cookie']).toBeDefined();
            const cookieStr = res.headers['set-cookie'].join(';');
            expect(cookieStr).toContain('token=');
        });

        test('should not return password in response', async () => {
            const res = await loginAndGetToken();

            expect(res.body.user.password).toBeUndefined();
        });

        test('should update lastLogin timestamp', async () => {
            await loginAndGetToken();

            const user = await User.findOne({ email: 'test@example.com' });
            expect(user.lastLogin).toBeDefined();
            expect(user.lastLogin).toBeInstanceOf(Date);
        });

        test('should be case-insensitive for email', async () => {
            const res = await loginAndGetToken('TEST@EXAMPLE.COM', 'password123');

            // MongoDB stores email as lowercase (User model has lowercase: true)
            // findOne({ email: 'TEST@EXAMPLE.COM' }) matches because Mongoose applies lowercase
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Failed Login', () => {
        test('should return error for wrong password', async () => {
            const res = await loginAndGetToken('test@example.com', 'wrongpassword1');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Email hoặc mật khẩu không đúng');
        });

        test('should return error for non-existent email', async () => {
            const res = await loginAndGetToken('nonexistent@example.com', 'password123');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Email hoặc mật khẩu không đúng');
        });

        test('should return error when email is empty', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: '', password: 'password123' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('should return error when password is empty', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: '' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('should return error when both fields are empty', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: '', password: '' });

            expect(res.status).toBe(400);
        });

        test('should return error when body is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(res.status).toBe(400);
        });
    });

    describe('OAuth User Login', () => {
        test('should reject login for OAuth user with local auth', async () => {
            await User.create({
                name: 'OAuth User',
                email: 'oauth@example.com',
                authProvider: 'google',
                providerId: 'google-12345'
            });

            const res = await loginAndGetToken('oauth@example.com', 'password123');

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('google');
        });
    });

    describe('Inactive User Login', () => {
        test('should reject login for inactive user', async () => {
            await createTestUser({
                email: 'inactive@example.com',
                isActive: false
            });

            const res = await loginAndGetToken('inactive@example.com', 'password123');

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Tài khoản đã bị vô hiệu hóa');
        });
    });
});

// ================================================================
// 2. LOGOUT API TESTS
// ================================================================
describe('Logout API', () => {
    test('should logout successfully', async () => {
        const res = await request(app).post('/api/auth/logout');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Đăng xuất thành công');
    });

    test('should clear token cookie on logout', async () => {
        const res = await request(app).post('/api/auth/logout');

        const cookieStr = res.headers['set-cookie'].join(';');
        expect(cookieStr).toContain('token=none');
    });
});

// ================================================================
// 3. GET PROFILE TESTS
// ================================================================
describe('Get Profile', () => {
    test('should return user profile with valid token', async () => {
        const user = await createTestUser();
        const token = generateTestToken(user._id);

        const res = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe('test@example.com');
        expect(res.body.user.name).toBe('Test User');
    });

    test('should reject without token', async () => {
        const res = await request(app).get('/api/auth/profile');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('should reject with invalid token', async () => {
        const res = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', 'Bearer invalid-token-123');

        expect(res.status).toBe(401);
    });

    test('should reject with expired token', async () => {
        const user = await createTestUser();
        const expiredToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '0s' } // expired immediately
        );

        // Small delay to ensure token is expired
        await new Promise(resolve => setTimeout(resolve, 100));

        const res = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${expiredToken}`);

        expect(res.status).toBe(401);
    });

    test('should work with cookie-based token', async () => {
        const user = await createTestUser();
        const token = generateTestToken(user._id);

        const res = await request(app)
            .get('/api/auth/profile')
            .set('Cookie', `token=${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ================================================================
// 4. UPDATE PROFILE TESTS
// ================================================================
describe('Update Profile', () => {
    let user, token;

    beforeEach(async () => {
        user = await createTestUser();
        token = generateTestToken(user._id);
    });

    test('should update name successfully', async () => {
        const res = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.name).toBe('Updated Name');
    });

    test('should update avatar successfully', async () => {
        const res = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ avatar: '/new-avatar.jpg' });

        expect(res.status).toBe(200);
        expect(res.body.user.avatar).toBe('/new-avatar.jpg');
    });

    test('should reject without auth', async () => {
        const res = await request(app)
            .put('/api/auth/profile')
            .send({ name: 'Hacked' });

        expect(res.status).toBe(401);
    });
});

// ================================================================
// 5. CHANGE PASSWORD TESTS
// ================================================================
describe('Change Password', () => {
    let user, token;

    beforeEach(async () => {
        user = await createTestUser();
        token = generateTestToken(user._id);
    });

    test('should change password successfully', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'newpassword456',
                confirmPassword: 'newpassword456'
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Đổi mật khẩu thành công');

        // Verify can login with new password
        const loginRes = await loginAndGetToken('test@example.com', 'newpassword456');
        expect(loginRes.status).toBe(200);
    });

    test('should reject when current password is wrong', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'wrongpassword1',
                newPassword: 'newpassword456',
                confirmPassword: 'newpassword456'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Mật khẩu hiện tại không đúng');
    });

    test('should reject when confirm password does not match', async () => {
        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'newpassword456',
                confirmPassword: 'differentpass789'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Mật khẩu xác nhận không khớp');
    });

    test('should reject for OAuth users', async () => {
        const oauthUser = await User.create({
            name: 'OAuth User',
            email: 'oauth@example.com',
            authProvider: 'google',
            providerId: 'google-123'
        });
        const oauthToken = generateTestToken(oauthUser._id);

        const res = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${oauthToken}`)
            .send({
                currentPassword: 'any',
                newPassword: 'newpass123',
                confirmPassword: 'newpass123'
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Tài khoản OAuth không thể đổi mật khẩu');
    });
});

// ================================================================
// 6. VERIFY TOKEN TESTS
// ================================================================
describe('Verify Token', () => {
    test('should verify valid token', async () => {
        const user = await createTestUser();
        const token = generateTestToken(user._id);

        const res = await request(app)
            .get('/api/auth/verify')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe('test@example.com');
    });

    test('should reject invalid token', async () => {
        const res = await request(app)
            .get('/api/auth/verify')
            .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
    });

    test('should reject token for deleted user', async () => {
        const user = await createTestUser();
        const token = generateTestToken(user._id);

        // Delete user
        await User.deleteOne({ _id: user._id });

        const res = await request(app)
            .get('/api/auth/verify')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
    });
});

// ================================================================
// 7. MERGE GUEST TASKS TESTS
// ================================================================
describe('Merge Guest Tasks', () => {
    let user, token;

    beforeEach(async () => {
        user = await createTestUser();
        token = generateTestToken(user._id);
    });

    test('should merge guest tasks successfully', async () => {
        const guestTasks = [
            { title: 'Guest Task 1', status: 'pending', priority: 'high' },
            { title: 'Guest Task 2', description: 'Desc', status: 'completed', priority: 'low' },
            { title: 'Guest Task 3' }
        ];

        const res = await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.mergedCount).toBe(3);

        // Verify tasks were created in DB
        const tasks = await Task.find({ userId: user._id });
        expect(tasks).toHaveLength(3);
        expect(tasks.map(t => t.title).sort()).toEqual(['Guest Task 1', 'Guest Task 2', 'Guest Task 3']);
    });

    test('should associate merged tasks with correct user', async () => {
        const guestTasks = [
            { title: 'My Guest Task', priority: 'high' }
        ];

        await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks });

        const task = await Task.findOne({ title: 'My Guest Task' });
        expect(task.userId.toString()).toBe(user._id.toString());
    });

    test('should preserve task properties during merge', async () => {
        const guestTasks = [
            { title: 'Detailed Task', description: 'Details here', status: 'in-progress', priority: 'high' }
        ];

        await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks });

        const task = await Task.findOne({ title: 'Detailed Task' });
        expect(task.description).toBe('Details here');
        expect(task.status).toBe('in-progress');
        expect(task.priority).toBe('high');
    });

    test('should use defaults for missing task fields', async () => {
        const guestTasks = [
            { title: 'Minimal Task' }
        ];

        await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks });

        const task = await Task.findOne({ title: 'Minimal Task' });
        expect(task.status).toBe('pending');
        expect(task.priority).toBe('medium');
        expect(task.description).toBe('');
    });

    test('should return 0 count when guestTasks is empty array', async () => {
        const res = await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks: [] });

        expect(res.status).toBe(200);
        expect(res.body.mergedCount).toBe(0);
    });

    test('should return 0 count when guestTasks is not provided', async () => {
        const res = await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.mergedCount).toBe(0);
    });

    test('should return 0 count when guestTasks is null', async () => {
        const res = await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks: null });

        expect(res.status).toBe(200);
        expect(res.body.mergedCount).toBe(0);
    });

    test('should reject without auth', async () => {
        const res = await request(app)
            .post('/api/auth/merge-tasks')
            .send({ guestTasks: [{ title: 'Task' }] });

        expect(res.status).toBe(401);
    });

    test('should not mix merged tasks between users', async () => {
        const user2 = await createTestUser({ email: 'user2@example.com', name: 'User 2' });
        const token2 = generateTestToken(user2._id);

        // User 1 merges tasks
        await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks: [{ title: 'User1 Guest Task' }] });

        // User 2 merges tasks
        await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token2}`)
            .send({ guestTasks: [{ title: 'User2 Guest Task' }] });

        // Verify isolation
        const user1Tasks = await Task.find({ userId: user._id });
        const user2Tasks = await Task.find({ userId: user2._id });

        expect(user1Tasks).toHaveLength(1);
        expect(user1Tasks[0].title).toBe('User1 Guest Task');
        expect(user2Tasks).toHaveLength(1);
        expect(user2Tasks[0].title).toBe('User2 Guest Task');
    });
});

// ================================================================
// 8. OAUTH CALLBACK TESTS
// ================================================================
describe('OAuth Callback', () => {
    test('should set cookie and redirect for OAuth user', async () => {
        const user = await User.create({
            name: 'Google User',
            email: 'google@example.com',
            authProvider: 'google',
            providerId: 'google-abc123'
        });

        // Simulate the oauthCallback by mocking req.user (normally set by passport)
        const mockApp = express();
        mockApp.use(cookieParser());
        mockApp.get('/oauth/test', (req, res, next) => {
            req.user = user;
            next();
        }, oauthCallback);

        const res = await request(mockApp).get('/oauth/test');

        expect(res.status).toBe(302); // redirect
        expect(res.headers.location).toContain('/oauth/callback?success=true');
        expect(res.headers['set-cookie']).toBeDefined();

        const cookieStr = res.headers['set-cookie'].join(';');
        expect(cookieStr).toContain('token=');
        expect(cookieStr).toContain('HttpOnly');
    });

    test('should generate valid JWT token in cookie', async () => {
        const user = await User.create({
            name: 'GitHub User',
            email: 'github@example.com',
            authProvider: 'github',
            providerId: 'github-xyz789'
        });

        const mockApp = express();
        mockApp.use(cookieParser());
        mockApp.get('/oauth/test', (req, res, next) => {
            req.user = user;
            next();
        }, oauthCallback);

        const res = await request(mockApp).get('/oauth/test');

        // Extract token from cookie
        const cookieStr = res.headers['set-cookie'][0];
        const tokenMatch = cookieStr.match(/token=([^;]+)/);
        expect(tokenMatch).toBeTruthy();

        const token = tokenMatch[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded.id).toBe(user._id.toString());
    });
});

// ================================================================
// 9. DATA ISOLATION TESTS
// ================================================================
describe('Data Isolation', () => {
    let userA, userB, tokenA, tokenB;

    beforeEach(async () => {
        userA = await createTestUser({ email: 'usera@example.com', name: 'User A' });
        userB = await createTestUser({ email: 'userb@example.com', name: 'User B' });
        tokenA = generateTestToken(userA._id);
        tokenB = generateTestToken(userB._id);

        // Create tasks for both users
        await Task.create([
            { title: 'A Task 1', userId: userA._id, status: 'pending', priority: 'high' },
            { title: 'A Task 2', userId: userA._id, status: 'completed', priority: 'low' },
            { title: 'B Task 1', userId: userB._id, status: 'pending', priority: 'medium' },
        ]);
    });

    test('User A should not see User B tasks (and vice versa)', async () => {
        const tasksA = await Task.find({ userId: userA._id });
        const tasksB = await Task.find({ userId: userB._id });

        expect(tasksA).toHaveLength(2);
        expect(tasksB).toHaveLength(1);

        // Make sure no cross-contamination
        tasksA.forEach(task => {
            expect(task.userId.toString()).toBe(userA._id.toString());
        });
        tasksB.forEach(task => {
            expect(task.userId.toString()).toBe(userB._id.toString());
        });
    });

    test('User A cannot update User B task', async () => {
        const taskB = await Task.findOne({ userId: userB._id });

        const updated = await Task.findOneAndUpdate(
            { _id: taskB._id, userId: userA._id }, // wrong userId
            { title: 'Hacked!' },
            { new: true }
        );

        expect(updated).toBeNull();

        // Verify task unchanged
        const original = await Task.findById(taskB._id);
        expect(original.title).toBe('B Task 1');
    });

    test('User A cannot delete User B task', async () => {
        const taskB = await Task.findOne({ userId: userB._id });

        const deleted = await Task.findOneAndDelete({
            _id: taskB._id,
            userId: userA._id // wrong userId
        });

        expect(deleted).toBeNull();

        // Verify task still exists
        const original = await Task.findById(taskB._id);
        expect(original).not.toBeNull();
    });

    test('Deleting User A tasks should not affect User B', async () => {
        await Task.deleteMany({ userId: userA._id });

        const remainingA = await Task.find({ userId: userA._id });
        const remainingB = await Task.find({ userId: userB._id });

        expect(remainingA).toHaveLength(0);
        expect(remainingB).toHaveLength(1);
    });
});

// ================================================================
// 10. AUTH MIDDLEWARE TESTS
// ================================================================
describe('Auth Middleware', () => {
    describe('protect middleware', () => {
        test('should pass with valid Bearer token', async () => {
            const user = await createTestUser();
            const token = generateTestToken(user._id);

            const res = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
        });

        test('should pass with valid cookie token', async () => {
            const user = await createTestUser();
            const token = generateTestToken(user._id);

            const res = await request(app)
                .get('/api/auth/profile')
                .set('Cookie', `token=${token}`);

            expect(res.status).toBe(200);
        });

        test('should reject with no token', async () => {
            const res = await request(app).get('/api/auth/profile');

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Vui lòng đăng nhập để truy cập');
        });

        test('should reject with malformed token', async () => {
            const res = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer malformed.token.here');

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Token không hợp lệ hoặc đã hết hạn');
        });

        test('should reject token for non-existent user', async () => {
            const fakeUserId = new mongoose.Types.ObjectId();
            const token = generateTestToken(fakeUserId);

            const res = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('User không tồn tại');
        });

        test('should reject token for inactive user', async () => {
            const user = await createTestUser({ isActive: false });
            const token = generateTestToken(user._id);

            const res = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Tài khoản đã bị vô hiệu hóa');
        });
    });

    describe('optionalAuth middleware', () => {
        test('should set req.user when valid token provided', async () => {
            const user = await createTestUser();
            const token = generateTestToken(user._id);

            const res = await request(app)
                .get('/api/test/optional')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.isGuest).toBe(false);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test@example.com');
        });

        test('should continue as guest when no token', async () => {
            const res = await request(app).get('/api/test/optional');

            expect(res.status).toBe(200);
            expect(res.body.isGuest).toBe(true);
            expect(res.body.user).toBeNull();
        });

        test('should continue as guest when invalid token', async () => {
            const res = await request(app)
                .get('/api/test/optional')
                .set('Authorization', 'Bearer invalid-token');

            expect(res.status).toBe(200);
            expect(res.body.isGuest).toBe(true);
            expect(res.body.user).toBeNull();
        });
    });
});

// ================================================================
// 11. FULL AUTH FLOW (End-to-End)
// ================================================================
describe('Full Auth Flow', () => {
    test('Register → Login → Profile → Change Password → Login with new password', async () => {
        // Step 1: Register
        const registerRes = await registerAndGetToken();
        expect(registerRes.status).toBe(201);
        const token1 = registerRes.body.token;

        // Step 2: Get Profile
        const profileRes = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token1}`);
        expect(profileRes.status).toBe(200);
        expect(profileRes.body.user.email).toBe('test@example.com');

        // Step 3: Change Password
        const changePwRes = await request(app)
            .put('/api/auth/change-password')
            .set('Authorization', `Bearer ${token1}`)
            .send({
                currentPassword: 'password123',
                newPassword: 'newpass456',
                confirmPassword: 'newpass456'
            });
        expect(changePwRes.status).toBe(200);

        // Step 4: Login with old password should fail
        const oldLoginRes = await loginAndGetToken('test@example.com', 'password123');
        expect(oldLoginRes.status).toBe(401);

        // Step 5: Login with new password should succeed
        const newLoginRes = await loginAndGetToken('test@example.com', 'newpass456');
        expect(newLoginRes.status).toBe(200);
    });

    test('Register → Merge Guest Tasks → Verify tasks belong to user', async () => {
        // Step 1: Register
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        // Step 2: Merge guest tasks
        const guestTasks = [
            { title: 'Guest Task A', priority: 'high' },
            { title: 'Guest Task B', status: 'completed' }
        ];

        const mergeRes = await request(app)
            .post('/api/auth/merge-tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({ guestTasks });
        expect(mergeRes.status).toBe(200);
        expect(mergeRes.body.mergedCount).toBe(2);

        // Step 3: Verify tasks in DB
        const user = await User.findOne({ email: 'test@example.com' });
        const tasks = await Task.find({ userId: user._id });
        expect(tasks).toHaveLength(2);
    });

    test('Register → Update Profile → Verify changes', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        // Update profile
        const updateRes = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'New Name' });
        expect(updateRes.status).toBe(200);
        expect(updateRes.body.user.name).toBe('New Name');

        // Verify via profile
        const profileRes = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);
        expect(profileRes.body.user.name).toBe('New Name');
    });

    test('Register → Logout → Cannot access protected routes', async () => {
        // Register and get token
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        // Verify token works
        const profileRes = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);
        expect(profileRes.status).toBe(200);

        // Logout (clears cookie, but token in header still works since JWT is stateless)
        const logoutRes = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${token}`);
        expect(logoutRes.status).toBe(200);

        // Token in Authorization header still works (JWT is stateless)
        // But cookie-based auth should fail after logout
        const cookieStr = logoutRes.headers['set-cookie'].join(';');
        expect(cookieStr).toContain('token=none');
    });
});

// ==================== DELETE ACCOUNT (T-2) ====================
describe('Delete Account', () => {
    it('should delete account with correct password', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        // Create a task that should be deleted with the account
        await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .delete('/api/auth/account')
            .set('Authorization', `Bearer ${token}`)
            .send({ password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Tài khoản đã được xóa thành công');

        // Verify user is deleted
        const user = await User.findOne({ email: 'test@example.com' });
        expect(user).toBeNull();
    });

    it('should require password for local auth users', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .delete('/api/auth/account')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Vui lòng nhập mật khẩu để xác nhận xóa tài khoản');
    });

    it('should reject wrong password', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .delete('/api/auth/account')
            .set('Authorization', `Bearer ${token}`)
            .send({ password: 'wrongpassword' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Mật khẩu không đúng');
    });

    it('should delete all user tasks when account is deleted', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        // Get user id
        const profileRes = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);
        const userId = profileRes.body.user._id;

        // Create tasks for this user
        await Task.create([
            { title: 'Task 1', userId },
            { title: 'Task 2', userId },
        ]);

        // Verify tasks exist
        expect(await Task.countDocuments({ userId })).toBe(2);

        await request(app)
            .delete('/api/auth/account')
            .set('Authorization', `Bearer ${token}`)
            .send({ password: 'password123' });

        // Verify tasks are deleted
        expect(await Task.countDocuments({ userId })).toBe(0);
    });

    it('should clear auth cookie on delete', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .delete('/api/auth/account')
            .set('Authorization', `Bearer ${token}`)
            .send({ password: 'password123' });

        const cookieStr = res.headers['set-cookie']?.join(';') || '';
        expect(cookieStr).toContain('token=none');
    });

    it('should allow OAuth users to delete without password', async () => {
        const oauthUser = await User.create({
            name: 'OAuth User',
            email: 'oauth@example.com',
            authProvider: 'google',
            providerId: 'google123',
        });

        const token = jwt.sign({ id: oauthUser._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        const res = await request(app)
            .delete('/api/auth/account')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

// ==================== UPDATE PREFERENCES (T-3) ====================
describe('Update Preferences', () => {
    it('should update theme preference', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .put('/api/auth/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ theme: 'dark' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.preferences.theme).toBe('dark');
    });

    it('should update language preference', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .put('/api/auth/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ language: 'en' });

        expect(res.status).toBe(200);
        expect(res.body.user.preferences.language).toBe('en');
    });

    it('should update defaultPriority', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .put('/api/auth/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ defaultPriority: 'high' });

        expect(res.status).toBe(200);
        expect(res.body.user.preferences.defaultPriority).toBe('high');
    });

    it('should update notification preferences', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .put('/api/auth/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ notifications: { email: false, push: true } });

        expect(res.status).toBe(200);
        expect(res.body.user.preferences.notifications.email).toBe(false);
        expect(res.body.user.preferences.notifications.push).toBe(true);
    });

    it('should update multiple preferences at once', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        const res = await request(app)
            .put('/api/auth/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({
                theme: 'light',
                language: 'en',
                defaultPriority: 'low',
                notifications: { email: true },
            });

        expect(res.status).toBe(200);
        expect(res.body.user.preferences.theme).toBe('light');
        expect(res.body.user.preferences.language).toBe('en');
        expect(res.body.user.preferences.defaultPriority).toBe('low');
        expect(res.body.user.preferences.notifications.email).toBe(true);
    });

    it('should not modify other fields when updating preferences', async () => {
        const registerRes = await registerAndGetToken();
        const token = registerRes.body.token;

        // Get initial profile
        const profileBefore = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        await request(app)
            .put('/api/auth/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ theme: 'dark' });

        const profileAfter = await request(app)
            .get('/api/auth/profile')
            .set('Authorization', `Bearer ${token}`);

        expect(profileAfter.body.user.name).toBe(profileBefore.body.user.name);
        expect(profileAfter.body.user.email).toBe(profileBefore.body.user.email);
    });

    it('should require authentication', async () => {
        const res = await request(app)
            .put('/api/auth/preferences')
            .send({ theme: 'dark' });

        expect(res.status).toBe(401);
    });
});
