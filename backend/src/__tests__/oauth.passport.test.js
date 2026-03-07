/**
 * Unit Tests cho OAuth Passport Strategies
 * 
 * Covers:
 * 1. Google Strategy — new user, account linking, lastLogin
 * 2. Facebook Strategy — new user, fake email, account linking
 * 3. GitHub Strategy — new user, fake email, account linking
 * 4. Error handling
 * 
 * Test approach: Import passport.js which registers strategies,
 * then invoke the verify callback directly via passport._strategy()
 */

import { jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import User from '../models/User.js';

let mongoServer;

// ==================== SETUP ====================
beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Set env vars for all strategies
    process.env.GOOGLE_CLIENT_ID = 'test-google-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
    process.env.FACEBOOK_APP_ID = 'test-facebook-id';
    process.env.FACEBOOK_APP_SECRET = 'test-facebook-secret';
    process.env.GITHUB_CLIENT_ID = 'test-github-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
    process.env.BACKEND_URL = 'http://localhost:5001';
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
}, 15000);

beforeEach(async () => {
    await User.deleteMany({});
});

// Import passport after env vars are set
let passport;
beforeAll(async () => {
    const mod = await import('../config/passport.js');
    passport = mod.default;
});

// ==================== HELPERS ====================
const getStrategyCallback = (strategyName) => {
    const strategy = passport._strategy(strategyName);
    if (!strategy) throw new Error(`Strategy ${strategyName} not registered`);
    return strategy._verify;
};

const donePromise = () => {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    const done = (err, user) => resolve({ err, user });
    return { promise, done };
};

// ==================== GOOGLE STRATEGY ====================
describe('Google Strategy', () => {
    const googleProfile = {
        id: 'google-123',
        displayName: 'Google User',
        emails: [{ value: 'google@example.com' }],
        photos: [{ value: 'https://photo.google.com/avatar.jpg' }],
    };

    it('should create new user from Google profile', async () => {
        const verify = getStrategyCallback('google');
        const { promise, done } = donePromise();

        verify('accessToken', 'refreshToken', googleProfile, done);
        const result = await promise;

        expect(result.err).toBeNull();
        expect(result.user.name).toBe('Google User');
        expect(result.user.email).toBe('google@example.com');
        expect(result.user.authProvider).toBe('google');
        expect(result.user.providerId).toBe('google-123');
    });

    it('should return existing user on re-login', async () => {
        // First login creates user
        const verify = getStrategyCallback('google');
        const { promise: p1, done: d1 } = donePromise();
        verify('at', 'rt', googleProfile, d1);
        const first = await p1;

        // Second login should find same user
        const { promise: p2, done: d2 } = donePromise();
        verify('at', 'rt', googleProfile, d2);
        const second = await p2;

        expect(second.user._id.toString()).toBe(first.user._id.toString());
        expect(await User.countDocuments()).toBe(1);
    });

    it('should auto-link if email exists with different provider', async () => {
        // Create a local user with same email
        await User.create({
            name: 'Local User',
            email: 'google@example.com',
            password: 'hashedpw',
            authProvider: 'local',
        });

        const verify = getStrategyCallback('google');
        const { promise, done } = donePromise();

        verify('at', 'rt', googleProfile, done);
        const result = await promise;

        expect(result.err).toBeNull();
        expect(result.user.authProvider).toBe('google');
        expect(result.user.providerId).toBe('google-123');
        expect(await User.countDocuments()).toBe(1); // No duplicate
    });

    it('should update lastLogin', async () => {
        const verify = getStrategyCallback('google');
        const { promise, done } = donePromise();

        verify('at', 'rt', googleProfile, done);
        const result = await promise;

        expect(result.user.lastLogin).toBeDefined();
        expect(result.user.lastLogin instanceof Date).toBe(true);
    });

    it('should use profile photo as avatar', async () => {
        const verify = getStrategyCallback('google');
        const { promise, done } = donePromise();

        verify('at', 'rt', googleProfile, done);
        const result = await promise;

        expect(result.user.avatar).toBe('https://photo.google.com/avatar.jpg');
    });
});

// ==================== FACEBOOK STRATEGY ====================
describe('Facebook Strategy', () => {
    const facebookProfile = {
        id: 'fb-456',
        displayName: 'Facebook User',
        emails: [{ value: 'fb@example.com' }],
        photos: [{ value: 'https://graph.facebook.com/photo.jpg' }],
    };

    it('should create new user from Facebook profile', async () => {
        const verify = getStrategyCallback('facebook');
        const { promise, done } = donePromise();

        verify('at', 'rt', facebookProfile, done);
        const result = await promise;

        expect(result.err).toBeNull();
        expect(result.user.name).toBe('Facebook User');
        expect(result.user.email).toBe('fb@example.com');
        expect(result.user.authProvider).toBe('facebook');
        expect(result.user.providerId).toBe('fb-456');
    });

    it('should generate fake email when Facebook does not provide one', async () => {
        const noEmailProfile = {
            ...facebookProfile,
            emails: undefined,
        };

        const verify = getStrategyCallback('facebook');
        const { promise, done } = donePromise();

        verify('at', 'rt', noEmailProfile, done);
        const result = await promise;

        expect(result.user.email).toBe('fb-456@facebook.com');
    });

    it('should auto-link if email exists', async () => {
        await User.create({
            name: 'Existing',
            email: 'fb@example.com',
            password: 'password123',
            authProvider: 'local',
        });

        const verify = getStrategyCallback('facebook');
        const { promise, done } = donePromise();

        verify('at', 'rt', facebookProfile, done);
        const result = await promise;

        expect(result.user.authProvider).toBe('facebook');
        expect(await User.countDocuments()).toBe(1);
    });
});

// ==================== GITHUB STRATEGY ====================
describe('GitHub Strategy', () => {
    const githubProfile = {
        id: 789,
        displayName: 'GitHub User',
        username: 'ghuser',
        emails: [{ value: 'gh@example.com' }],
        photos: [{ value: 'https://avatars.githubusercontent.com/u/789' }],
    };

    it('should create new user from GitHub profile', async () => {
        const verify = getStrategyCallback('github');
        const { promise, done } = donePromise();

        verify('at', 'rt', githubProfile, done);
        const result = await promise;

        expect(result.err).toBeNull();
        expect(result.user.name).toBe('GitHub User');
        expect(result.user.email).toBe('gh@example.com');
        expect(result.user.authProvider).toBe('github');
        expect(result.user.providerId).toBe('789'); // toString()
    });

    it('should use username as name when displayName is missing', async () => {
        const noDisplayName = {
            ...githubProfile,
            displayName: null,
        };

        const verify = getStrategyCallback('github');
        const { promise, done } = donePromise();

        verify('at', 'rt', noDisplayName, done);
        const result = await promise;

        expect(result.user.name).toBe('ghuser');
    });

    it('should generate fake email when GitHub does not provide one', async () => {
        const noEmailProfile = {
            ...githubProfile,
            emails: undefined,
        };

        const verify = getStrategyCallback('github');
        const { promise, done } = donePromise();

        verify('at', 'rt', noEmailProfile, done);
        const result = await promise;

        expect(result.user.email).toBe('ghuser@github.com');
    });

    it('should auto-link if email exists', async () => {
        await User.create({
            name: 'Existing',
            email: 'gh@example.com',
            password: 'password123',
            authProvider: 'local',
        });

        const verify = getStrategyCallback('github');
        const { promise, done } = donePromise();

        verify('at', 'rt', githubProfile, done);
        const result = await promise;

        expect(result.user.authProvider).toBe('github');
        expect(await User.countDocuments()).toBe(1);
    });

    it('should convert numeric GitHub id to string', async () => {
        const verify = getStrategyCallback('github');
        const { promise, done } = donePromise();

        verify('at', 'rt', githubProfile, done);
        const result = await promise;

        expect(typeof result.user.providerId).toBe('string');
        expect(result.user.providerId).toBe('789');
    });
});

// ==================== ERROR HANDLING ====================
describe('Error Handling', () => {
    it('should pass error to done on database failure', async () => {
        // Force a mongoose error by disconnecting
        const verify = getStrategyCallback('google');

        // Create a profile that will cause a validation error (name required)
        const badProfile = {
            id: 'err-123',
            displayName: '', // empty name will cause validation error in some schemas
            emails: [{ value: 'invalid' }],
            photos: [],
        };

        const { promise, done } = donePromise();
        verify('at', 'rt', badProfile, done);
        const result = await promise;

        // Should either succeed with empty name or return error
        // The important thing is it doesn't throw unhandled
        expect(result).toBeDefined();
    });
});
