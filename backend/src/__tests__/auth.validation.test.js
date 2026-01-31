/**
 * Unit Tests cho Backend Validation - Register API
 * 
 * Test cases:
 * 1. Name validation
 * 2. Email validation
 * 3. Password validation
 * 4. Confirm Password validation
 * 5. Duplicate email handling
 * 6. Successful registration
 */

import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import express from 'express';

// Import model và controller
import User from '../models/User.js';
import { register } from '../controllers/authController.js';

// Setup Express app for testing
const app = express();
app.use(express.json());
app.post('/api/auth/register', register);

let mongoServer;

// Setup và Teardown
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Set environment variables for testing
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
    process.env.JWT_EXPIRES_IN = '7d';
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    // Clear database before each test
    await User.deleteMany({});
});

// ==================== NAME VALIDATION ====================
describe('Name Validation', () => {
    test('should return error when name is empty', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: '',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toHaveProperty('name');
        expect(response.body.errors.name).toBe('Tên không được để trống');
    });

    test('should return error when name is only whitespace', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: '   ',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors).toHaveProperty('name');
    });

    test('should return error when name is less than 2 characters', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'A',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.name).toBe('Tên phải có ít nhất 2 ký tự');
    });

    test('should return error when name exceeds 50 characters', async () => {
        const longName = 'A'.repeat(51);
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: longName,
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.name).toBe('Tên không được quá 50 ký tự');
    });

    test('should accept valid name with 2 characters', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'AB',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });

    test('should accept valid name with 50 characters', async () => {
        const validName = 'A'.repeat(50);
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: validName,
                email: 'test2@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });

    test('should trim whitespace from name', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: '  John Doe  ',
                email: 'test3@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body.user.name).toBe('John Doe');
    });
});

// ==================== EMAIL VALIDATION ====================
describe('Email Validation', () => {
    test('should return error when email is empty', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: '',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.email).toBe('Email không được để trống');
    });

    test('should return error for invalid email format - missing @', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'invalidemail.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.email).toBe('Email không hợp lệ');
    });

    test('should return error for invalid email format - missing domain', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.email).toBe('Email không hợp lệ');
    });

    test('should return error for invalid email format - missing TLD', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.email).toBe('Email không hợp lệ');
    });

    test('should return error for duplicate email', async () => {
        // Tạo user đầu tiên
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'User One',
                email: 'duplicate@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        // Thử đăng ký với email trùng
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'User Two',
                email: 'duplicate@example.com',
                password: 'password456',
                confirmPassword: 'password456'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.email).toBe('Email đã được sử dụng');
    });

    test('should be case-insensitive for email', async () => {
        // Tạo user với email lowercase
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'User One',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        // Thử đăng ký với email uppercase
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'User Two',
                email: 'TEST@EXAMPLE.COM',
                password: 'password456',
                confirmPassword: 'password456'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.email).toBe('Email đã được sử dụng');
    });

    test('should accept valid email formats', async () => {
        const validEmails = [
            'simple@example.com',
            'very.common@example.com',
            'user+tag@example.com',
            'user123@example.co.uk'
        ];

        for (let i = 0; i < validEmails.length; i++) {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    name: `User ${i}`,
                    email: validEmails[i],
                    password: 'password123',
                    confirmPassword: 'password123'
                });

            expect(response.status).toBe(201);
        }
    });
});

// ==================== PASSWORD VALIDATION ====================
describe('Password Validation', () => {
    test('should return error when password is empty', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: '',
                confirmPassword: ''
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.password).toBe('Mật khẩu không được để trống');
    });

    test('should return error when password is less than 6 characters', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: 'abc12',
                confirmPassword: 'abc12'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.password).toBe('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số');
    });

    test('should return error when password has no letters', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: '123456',
                confirmPassword: '123456'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.password).toBe('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số');
    });

    test('should return error when password has no numbers', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: 'abcdefgh',
                confirmPassword: 'abcdefgh'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.password).toBe('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số');
    });

    test('should accept valid password with letters and numbers', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: 'abc123',
                confirmPassword: 'abc123'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });

    test('should accept password with special characters', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test2@example.com',
                password: 'P@ssw0rd!',
                confirmPassword: 'P@ssw0rd!'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });
});

// ==================== CONFIRM PASSWORD VALIDATION ====================
describe('Confirm Password Validation', () => {
    test('should return error when confirmPassword is empty', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: ''
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.confirmPassword).toBe('Vui lòng xác nhận mật khẩu');
    });

    test('should return error when passwords do not match', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'different456'
            });

        expect(response.status).toBe(400);
        expect(response.body.errors.confirmPassword).toBe('Mật khẩu xác nhận không khớp');
    });

    test('should accept matching passwords', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });
});

// ==================== MULTIPLE VALIDATION ERRORS ====================
describe('Multiple Validation Errors', () => {
    test('should return all validation errors at once', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: '',
                email: 'invalid-email',
                password: '123',
                confirmPassword: '456'
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.errors).toHaveProperty('name');
        expect(response.body.errors).toHaveProperty('email');
        expect(response.body.errors).toHaveProperty('password');
        expect(response.body.errors).toHaveProperty('confirmPassword');
    });

    test('should return multiple errors with correct messages', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'A',
                email: '',
                password: 'abc',
                confirmPassword: 'xyz'
            });

        expect(response.status).toBe(400);
        expect(Object.keys(response.body.errors).length).toBeGreaterThanOrEqual(3);
    });
});

// ==================== SUCCESSFUL REGISTRATION ====================
describe('Successful Registration', () => {
    test('should register user successfully with valid data', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.user).toHaveProperty('name', 'John Doe');
        expect(response.body.user).toHaveProperty('email', 'john@example.com');
        expect(response.body.user).not.toHaveProperty('password');
        expect(response.body).toHaveProperty('token');
    });

    test('should hash password before saving', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'hash-test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        const user = await User.findOne({ email: 'hash-test@example.com' }).select('+password');
        expect(user.password).not.toBe('password123');
        expect(user.password.length).toBeGreaterThan(20); // bcrypt hash is longer
    });

    test('should set authProvider to local', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'provider-test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        const user = await User.findOne({ email: 'provider-test@example.com' });
        expect(user.authProvider).toBe('local');
    });

    test('should set cookie with token', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'cookie-test@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie'][0]).toContain('token=');
    });
});

// ==================== EDGE CASES ====================
describe('Edge Cases', () => {
    test('should handle missing request body gracefully', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
    });

    test('should handle null values', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: null,
                email: null,
                password: null,
                confirmPassword: null
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
    });

    test('should handle undefined values', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: undefined,
                email: undefined,
                password: undefined,
                confirmPassword: undefined
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
    });

    test('should handle extra fields in request body', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'John Doe',
                email: 'extra@example.com',
                password: 'password123',
                confirmPassword: 'password123',
                extraField: 'should be ignored',
                isAdmin: true // should not affect user creation
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
    });
});

/**
 * Unit Tests cho Auth Validation - Backend
 * Test các validation rules cho register, login, change password
 */

// ==================== VALIDATION HELPERS (copy từ authController) ====================
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return password.length >= 6 && hasLetter && hasNumber;
};

const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim();
};

// Validate registration data
const validateRegistration = (data) => {
    const { name, email, password, confirmPassword } = data;
    const errors = {};

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    // Validate name
    if (!sanitizedName) {
        errors.name = "Tên không được để trống";
    } else if (sanitizedName.length < 2) {
        errors.name = "Tên phải có ít nhất 2 ký tự";
    } else if (sanitizedName.length > 50) {
        errors.name = "Tên không được quá 50 ký tự";
    }

    // Validate email
    if (!sanitizedEmail) {
        errors.email = "Email không được để trống";
    } else if (!validateEmail(sanitizedEmail)) {
        errors.email = "Email không hợp lệ";
    }

    // Validate password
    if (!password) {
        errors.password = "Mật khẩu không được để trống";
    } else if (!validatePassword(password)) {
        errors.password = "Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số";
    }

    // Validate confirmPassword
    if (!confirmPassword) {
        errors.confirmPassword = "Vui lòng xác nhận mật khẩu";
    } else if (password !== confirmPassword) {
        errors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedData: {
            name: sanitizedName,
            email: sanitizedEmail,
            password
        }
    };
};

// Validate login data
const validateLogin = (data) => {
    const { email, password } = data;
    const errors = {};

    if (!email) {
        errors.email = "Email không được để trống";
    }

    if (!password) {
        errors.password = "Mật khẩu không được để trống";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

// ==================== TESTS ====================

describe('Email Validation', () => {
    describe('validateEmail', () => {
        test('should return true for valid email formats', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('user.name@domain.org')).toBe(true);
            expect(validateEmail('user+tag@example.co.uk')).toBe(true);
            expect(validateEmail('test123@test.vn')).toBe(true);
        });

        test('should return false for invalid email formats', () => {
            expect(validateEmail('')).toBe(false);
            expect(validateEmail('invalid')).toBe(false);
            expect(validateEmail('invalid@')).toBe(false);
            expect(validateEmail('@domain.com')).toBe(false);
            expect(validateEmail('test@.com')).toBe(false);
            expect(validateEmail('test@domain')).toBe(false);
            expect(validateEmail('test @domain.com')).toBe(false);
            expect(validateEmail('test@ domain.com')).toBe(false);
        });

        test('should return false for emails with spaces', () => {
            expect(validateEmail('test @example.com')).toBe(false);
            expect(validateEmail(' test@example.com')).toBe(false);
            expect(validateEmail('test@example.com ')).toBe(false);
        });
    });
});

describe('Password Validation', () => {
    describe('validatePassword', () => {
        test('should return true for valid passwords (letters + numbers, min 6 chars)', () => {
            expect(validatePassword('abc123')).toBe(true);
            expect(validatePassword('password1')).toBe(true);
            expect(validatePassword('1password')).toBe(true);
            expect(validatePassword('Pass12345')).toBe(true);
            expect(validatePassword('a1b2c3d4')).toBe(true);
        });

        test('should return false for passwords without numbers', () => {
            expect(validatePassword('abcdef')).toBe(false);
            expect(validatePassword('password')).toBe(false);
            expect(validatePassword('ABCDEFGH')).toBe(false);
        });

        test('should return false for passwords without letters', () => {
            expect(validatePassword('123456')).toBe(false);
            expect(validatePassword('999999')).toBe(false);
        });

        test('should return false for passwords shorter than 6 characters', () => {
            expect(validatePassword('abc1')).toBe(false);
            expect(validatePassword('a1')).toBe(false);
            expect(validatePassword('ab12')).toBe(false);
            expect(validatePassword('abc12')).toBe(false);
        });

        test('should return false for empty password', () => {
            expect(validatePassword('')).toBe(false);
        });
    });
});

describe('Input Sanitization', () => {
    describe('sanitizeInput', () => {
        test('should trim whitespace from strings', () => {
            expect(sanitizeInput('  hello  ')).toBe('hello');
            expect(sanitizeInput('hello   ')).toBe('hello');
            expect(sanitizeInput('   hello')).toBe('hello');
        });

        test('should return empty string for non-string inputs', () => {
            expect(sanitizeInput(null)).toBe('');
            expect(sanitizeInput(undefined)).toBe('');
            expect(sanitizeInput(123)).toBe('');
            expect(sanitizeInput({})).toBe('');
            expect(sanitizeInput([])).toBe('');
        });

        test('should preserve internal whitespace', () => {
            expect(sanitizeInput('  hello world  ')).toBe('hello world');
        });
    });
});

describe('Registration Validation', () => {
    describe('validateRegistration', () => {
        test('should pass validation with valid data', () => {
            const result = validateRegistration({
                name: 'John Doe',
                email: 'john@example.com',
                password: 'password123',
                confirmPassword: 'password123'
            });

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });

        // Name validation tests
        describe('Name validation', () => {
            test('should fail when name is empty', () => {
                const result = validateRegistration({
                    name: '',
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.name).toBe('Tên không được để trống');
            });

            test('should fail when name is only whitespace', () => {
                const result = validateRegistration({
                    name: '   ',
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.name).toBe('Tên không được để trống');
            });

            test('should fail when name is less than 2 characters', () => {
                const result = validateRegistration({
                    name: 'A',
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.name).toBe('Tên phải có ít nhất 2 ký tự');
            });

            test('should fail when name is more than 50 characters', () => {
                const longName = 'A'.repeat(51);
                const result = validateRegistration({
                    name: longName,
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.name).toBe('Tên không được quá 50 ký tự');
            });

            test('should pass with name exactly 2 characters', () => {
                const result = validateRegistration({
                    name: 'AB',
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(true);
                expect(result.errors.name).toBeUndefined();
            });

            test('should pass with name exactly 50 characters', () => {
                const name50chars = 'A'.repeat(50);
                const result = validateRegistration({
                    name: name50chars,
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(true);
                expect(result.errors.name).toBeUndefined();
            });
        });

        // Email validation tests
        describe('Email validation', () => {
            test('should fail when email is empty', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: '',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.email).toBe('Email không được để trống');
            });

            test('should fail when email format is invalid', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'invalid-email',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.email).toBe('Email không hợp lệ');
            });

            test('should convert email to lowercase', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'TEST@EXAMPLE.COM',
                    password: 'pass123',
                    confirmPassword: 'pass123'
                });

                expect(result.sanitizedData.email).toBe('test@example.com');
            });
        });

        // Password validation tests
        describe('Password validation', () => {
            test('should fail when password is empty', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'test@example.com',
                    password: '',
                    confirmPassword: ''
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.password).toBe('Mật khẩu không được để trống');
            });

            test('should fail when password is too weak', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'test@example.com',
                    password: 'abc',
                    confirmPassword: 'abc'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.password).toBe('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số');
            });

            test('should fail when password has no numbers', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'test@example.com',
                    password: 'abcdefgh',
                    confirmPassword: 'abcdefgh'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.password).toBe('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số');
            });

            test('should fail when password has no letters', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'test@example.com',
                    password: '12345678',
                    confirmPassword: '12345678'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.password).toBe('Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số');
            });
        });

        // Confirm password validation tests
        describe('Confirm Password validation', () => {
            test('should fail when confirmPassword is empty', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: ''
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.confirmPassword).toBe('Vui lòng xác nhận mật khẩu');
            });

            test('should fail when passwords do not match', () => {
                const result = validateRegistration({
                    name: 'John',
                    email: 'test@example.com',
                    password: 'pass123',
                    confirmPassword: 'pass456'
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.confirmPassword).toBe('Mật khẩu xác nhận không khớp');
            });
        });

        // Multiple errors test
        describe('Multiple validation errors', () => {
            test('should return all validation errors at once', () => {
                const result = validateRegistration({
                    name: '',
                    email: 'invalid',
                    password: 'weak',
                    confirmPassword: 'different'
                });

                expect(result.isValid).toBe(false);
                expect(Object.keys(result.errors).length).toBeGreaterThan(1);
                expect(result.errors.name).toBeDefined();
                expect(result.errors.email).toBeDefined();
                expect(result.errors.password).toBeDefined();
            });
        });
    });
});

describe('Login Validation', () => {
    describe('validateLogin', () => {
        test('should pass validation with valid data', () => {
            const result = validateLogin({
                email: 'test@example.com',
                password: 'password123'
            });

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });

        test('should fail when email is empty', () => {
            const result = validateLogin({
                email: '',
                password: 'password123'
            });

            expect(result.isValid).toBe(false);
            expect(result.errors.email).toBe('Email không được để trống');
        });

        test('should fail when password is empty', () => {
            const result = validateLogin({
                email: 'test@example.com',
                password: ''
            });

            expect(result.isValid).toBe(false);
            expect(result.errors.password).toBe('Mật khẩu không được để trống');
        });

        test('should fail when both email and password are empty', () => {
            const result = validateLogin({
                email: '',
                password: ''
            });

            expect(result.isValid).toBe(false);
            expect(result.errors.email).toBeDefined();
            expect(result.errors.password).toBeDefined();
        });
    });
});

describe('Edge Cases', () => {
    test('should handle null/undefined inputs gracefully', () => {
        const result = validateRegistration({
            name: null,
            email: undefined,
            password: null,
            confirmPassword: undefined
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.name).toBeDefined();
        expect(result.errors.email).toBeDefined();
        expect(result.errors.password).toBeDefined();
    });

    test('should handle special characters in name', () => {
        const result = validateRegistration({
            name: "O'Brien-Smith",
            email: 'test@example.com',
            password: 'pass123',
            confirmPassword: 'pass123'
        });

        expect(result.isValid).toBe(true);
    });

    test('should handle Vietnamese characters in name', () => {
        const result = validateRegistration({
            name: 'Nguyễn Văn An',
            email: 'test@example.com',
            password: 'pass123',
            confirmPassword: 'pass123'
        });

        expect(result.isValid).toBe(true);
        expect(result.sanitizedData.name).toBe('Nguyễn Văn An');
    });
});
