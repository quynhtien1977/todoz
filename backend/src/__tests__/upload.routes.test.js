/**
 * Integration Tests for Upload Routes
 * Tests: POST /avatar, DELETE /avatar, PUT /avatar/system,
 *        POST /music-avatar/:musicId, POST /music-avatar-temp
 *
 * Uses supertest with a mini Express app, mocking Cloudinary.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

// ==================== ESM Mocking ====================
const mockUploadStream = jest.fn();
const mockCloudinaryDestroy = jest.fn();
const mockDeleteCustomThumbnail = jest.fn();

jest.unstable_mockModule("../config/cloudinary.js", () => ({
    default: {
        uploader: {
            upload_stream: mockUploadStream,
            destroy: mockCloudinaryDestroy,
        },
    },
}));

jest.unstable_mockModule("../controllers/musicController.js", () => ({
    deleteCustomThumbnail: mockDeleteCustomThumbnail,
}));

const { protect } = await import("../middleware/authMiddleware.js");
const User = (await import("../models/User.js")).default;
const Music = (await import("../models/Music.js")).default;
const uploadRoute = (await import("../routes/uploadRoutes.js")).default;

// ==================== App Setup ====================
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/upload", uploadRoute);

const JWT_SECRET = "test-secret-key-for-upload-tests";

// ==================== Helpers ====================
let mongoServer;
let testUser, adminUser;

const getToken = (user) => jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });

// Create a fake 1x1 PNG buffer for file uploads (minimal valid PNG)
const fakePngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
);

// Helper to simulate cloudinary upload_stream behavior
const setupUploadStreamMock = (secureUrl = "https://res.cloudinary.com/test/image/upload/result.webp", publicId = "todoz-avatars/avatar_test") => {
    mockUploadStream.mockImplementation((options, callback) => {
        // Return a writable stream-like object
        const stream = {
            end: jest.fn(() => {
                // Call the callback asynchronously to simulate upload
                callback(null, { secure_url: secureUrl, public_id: publicId });
            }),
        };
        return stream;
    });
};

beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Music.deleteMany({});
    mockUploadStream.mockReset();
    mockCloudinaryDestroy.mockReset();
    mockDeleteCustomThumbnail.mockReset();
    mockCloudinaryDestroy.mockResolvedValue({ result: "ok" });
    mockDeleteCustomThumbnail.mockResolvedValue(undefined);

    testUser = await User.create({
        name: "Test User", email: "test@upload.com",
        password: "password123", authProvider: "local", role: "free",
        avatar: "/default_avatar.jpg",
    });
    adminUser = await User.create({
        name: "Admin", email: "admin@upload.com",
        password: "password123", authProvider: "local", role: "admin",
        avatar: "/default_avatar.jpg",
    });
});

// ============================================
// POST /api/upload/avatar
// ============================================
describe("POST /api/upload/avatar", () => {
    it("should return 401 without auth", async () => {
        const res = await request(app)
            .post("/api/upload/avatar")
            .attach("avatar", fakePngBuffer, "test.png");

        expect(res.status).toBe(401);
    });

    it("should return 400 when no file attached", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .post("/api/upload/avatar")
            .set("Cookie", `token=${token}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("file ảnh");
    });

    it("should upload avatar and update user", async () => {
        const token = getToken(testUser);
        const avatarUrl = "https://res.cloudinary.com/test/image/upload/todoz-avatars/avatar_test.webp";
        setupUploadStreamMock(avatarUrl, `todoz-avatars/avatar_${testUser._id}`);

        const res = await request(app)
            .post("/api/upload/avatar")
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "avatar.png");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.avatar).toBe(avatarUrl);

        // Verify DB was updated
        const updated = await User.findById(testUser._id);
        expect(updated.avatar).toBe(avatarUrl);
    });

    it("should reject non-image files", async () => {
        const token = getToken(testUser);
        const textBuffer = Buffer.from("not an image");

        const res = await request(app)
            .post("/api/upload/avatar")
            .set("Cookie", `token=${token}`)
            .attach("avatar", textBuffer, { filename: "test.txt", contentType: "text/plain" });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("file ảnh");
    });
});

// ============================================
// DELETE /api/upload/avatar
// ============================================
describe("DELETE /api/upload/avatar", () => {
    it("should return 401 without auth", async () => {
        const res = await request(app).delete("/api/upload/avatar");
        expect(res.status).toBe(401);
    });

    it("should reset avatar to default", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .delete("/api/upload/avatar")
            .set("Cookie", `token=${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await User.findById(testUser._id);
        expect(updated.avatar).toBe("/default_avatar.jpg");
    });

    it("should delete from Cloudinary when avatar is Cloudinary URL", async () => {
        testUser.avatar = "https://res.cloudinary.com/test/image/upload/todoz-avatars/avatar_test.webp";
        await testUser.save();

        const token = getToken(testUser);
        await request(app)
            .delete("/api/upload/avatar")
            .set("Cookie", `token=${token}`);

        expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
            `todoz-avatars/avatar_${testUser._id}`,
            { resource_type: "image" }
        );
    });

    it("should NOT call Cloudinary destroy for non-Cloudinary avatar", async () => {
        testUser.avatar = "/avatars/system/cat.svg";
        await testUser.save();

        const token = getToken(testUser);
        await request(app)
            .delete("/api/upload/avatar")
            .set("Cookie", `token=${token}`);

        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });
});

// ============================================
// PUT /api/upload/avatar/system
// ============================================
describe("PUT /api/upload/avatar/system", () => {
    it("should return 401 without auth", async () => {
        const res = await request(app)
            .put("/api/upload/avatar/system")
            .send({ avatarId: "cat" });
        expect(res.status).toBe(401);
    });

    it("should set valid system avatar", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .put("/api/upload/avatar/system")
            .set("Cookie", `token=${token}`)
            .send({ avatarId: "cat" });

        expect(res.status).toBe(200);
        expect(res.body.avatar).toBe("/avatars/system/cat.svg");

        const updated = await User.findById(testUser._id);
        expect(updated.avatar).toBe("/avatars/system/cat.svg");
    });

    it("should reject invalid avatar ID", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .put("/api/upload/avatar/system")
            .set("Cookie", `token=${token}`)
            .send({ avatarId: "invalid-avatar" });

        expect(res.status).toBe(400);
    });

    it("should reject missing avatarId", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .put("/api/upload/avatar/system")
            .set("Cookie", `token=${token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it("should accept all valid system avatars", async () => {
        const validAvatars = ["cat", "dog", "fox", "panda", "koala", "owl", "penguin", "rabbit", "bear", "unicorn", "astronaut", "robot"];
        const token = getToken(testUser);

        for (const avatarId of validAvatars) {
            const res = await request(app)
                .put("/api/upload/avatar/system")
                .set("Cookie", `token=${token}`)
                .send({ avatarId });

            expect(res.status).toBe(200);
            expect(res.body.avatar).toBe(`/avatars/system/${avatarId}.svg`);
        }
    });

    it("should delete old Cloudinary avatar before switching to system", async () => {
        testUser.avatar = "https://res.cloudinary.com/test/image/upload/todoz-avatars/avatar_test.webp";
        await testUser.save();

        const token = getToken(testUser);
        await request(app)
            .put("/api/upload/avatar/system")
            .set("Cookie", `token=${token}`)
            .send({ avatarId: "fox" });

        expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
            `todoz-avatars/avatar_${testUser._id}`,
            { resource_type: "image" }
        );
    });
});

// ============================================
// POST /api/upload/music-avatar/:musicId
// ============================================
describe("POST /api/upload/music-avatar/:musicId", () => {
    let userSong;

    beforeEach(async () => {
        userSong = await Music.create({
            name: "Test Song", userId: testUser._id,
            thumbnail: null,
        });
    });

    it("should return 401 without auth", async () => {
        const res = await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        expect(res.status).toBe(401);
    });

    it("should return 404 for non-existent music", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const token = getToken(testUser);
        const res = await request(app)
            .post(`/api/upload/music-avatar/${fakeId}`)
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        expect(res.status).toBe(404);
    });

    it("should return 403 for non-owner", async () => {
        const otherUser = await User.create({
            name: "Other", email: "other@test.com",
            password: "password123", authProvider: "local", role: "free",
        });
        const token = getToken(otherUser);
        const res = await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        expect(res.status).toBe(403);
    });

    it("should allow owner to upload music avatar", async () => {
        const token = getToken(testUser);
        const thumbUrl = "https://res.cloudinary.com/test/image/upload/todoz-music-avatars/music_test.webp";
        setupUploadStreamMock(thumbUrl, `todoz-music-avatars/music_${userSong._id}`);

        const res = await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        expect(res.status).toBe(200);
        expect(res.body.thumbnail).toBe(thumbUrl);

        // Verify DB
        const updated = await Music.findById(userSong._id);
        expect(updated.thumbnail).toBe(thumbUrl);
    });

    it("should allow admin to upload avatar for any music", async () => {
        const token = getToken(adminUser);
        const thumbUrl = "https://res.cloudinary.com/test/image/upload/todoz-music-avatars/music_admin.webp";
        setupUploadStreamMock(thumbUrl, `todoz-music-avatars/music_${userSong._id}`);

        const res = await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        expect(res.status).toBe(200);
    });

    it("should delete old thumbnail before uploading new one", async () => {
        const oldThumb = "https://res.cloudinary.com/test/image/upload/todoz-music-avatars/music_old.webp";
        await Music.findByIdAndUpdate(userSong._id, { thumbnail: oldThumb });

        const token = getToken(testUser);
        setupUploadStreamMock(
            "https://res.cloudinary.com/test/image/upload/todoz-music-avatars/music_new.webp",
            `todoz-music-avatars/music_${userSong._id}`
        );

        await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        // Should have called deleteCustomThumbnail with old URL
        expect(mockDeleteCustomThumbnail).toHaveBeenCalledWith(oldThumb);
    });

    it("should NOT call deleteCustomThumbnail when no old thumbnail", async () => {
        const token = getToken(testUser);
        setupUploadStreamMock(
            "https://res.cloudinary.com/test/image/upload/todoz-music-avatars/music_new.webp",
            `todoz-music-avatars/music_${userSong._id}`
        );

        await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "thumb.png");

        expect(mockDeleteCustomThumbnail).not.toHaveBeenCalled();
    });

    it("should return 400 when no file attached", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .post(`/api/upload/music-avatar/${userSong._id}`)
            .set("Cookie", `token=${token}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toContain("file ảnh");
    });
});

// ============================================
// POST /api/upload/music-avatar-temp
// ============================================
describe("POST /api/upload/music-avatar-temp", () => {
    it("should return 401 without auth", async () => {
        const res = await request(app)
            .post("/api/upload/music-avatar-temp")
            .attach("avatar", fakePngBuffer, "temp.png");

        expect(res.status).toBe(401);
    });

    it("should upload temp thumbnail and return URL", async () => {
        const token = getToken(testUser);
        const tempUrl = "https://res.cloudinary.com/test/image/upload/todoz-music-avatars/temp_test.webp";
        setupUploadStreamMock(tempUrl, "todoz-music-avatars/temp_test_123");

        const res = await request(app)
            .post("/api/upload/music-avatar-temp")
            .set("Cookie", `token=${token}`)
            .attach("avatar", fakePngBuffer, "temp.png");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.thumbnail).toBe(tempUrl);
        expect(res.body.publicId).toBeDefined();
    });

    it("should return 400 when no file attached", async () => {
        const token = getToken(testUser);
        const res = await request(app)
            .post("/api/upload/music-avatar-temp")
            .set("Cookie", `token=${token}`);

        expect(res.status).toBe(400);
    });
});
