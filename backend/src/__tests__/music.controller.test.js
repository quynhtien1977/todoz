/**
 * Unit Tests for Music Controller
 * Tests: getAllMusic, getMusicById, addMusic, previewYouTube, addFromYouTube,
 *        updateMusic, deleteMusic, toggleFavorite, incrementPlayCount, seedMusic,
 *        deleteCustomThumbnail (Cloudinary cleanup)
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// ==================== ESM Mocking ====================
// Must call jest.unstable_mockModule BEFORE dynamic import

const mockExtractAndUpload = jest.fn();
const mockGetVideoInfo = jest.fn();
const mockDeleteFromCloudinary = jest.fn();
const mockCloudinaryDestroy = jest.fn();

jest.unstable_mockModule("../utils/youtubeService.js", () => ({
    extractAndUpload: mockExtractAndUpload,
    getVideoInfo: mockGetVideoInfo,
    deleteFromCloudinary: mockDeleteFromCloudinary,
}));

jest.unstable_mockModule("../config/cloudinary.js", () => ({
    default: {
        uploader: {
            destroy: mockCloudinaryDestroy,
        },
    },
}));

// Dynamic import AFTER mocks
const {
    getAllMusic,
    getMusicById,
    addMusic,
    previewYouTube,
    addFromYouTube,
    updateMusic,
    deleteMusic,
    toggleFavorite,
    incrementPlayCount,
    seedMusic,
    deleteCustomThumbnail,
} = await import("../controllers/musicController.js");

const Music = (await import("../models/Music.js")).default;
const User = (await import("../models/User.js")).default;

// ==================== Helpers ====================
let mongoServer;

const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const mockRequest = (options = {}) => ({
    user: options.user || null,
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
});

// ==================== Test Data ====================
let freeUser, proUser, adminUser;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Music.deleteMany({});
    await User.deleteMany({});

    // Reset mocks
    mockExtractAndUpload.mockReset();
    mockGetVideoInfo.mockReset();
    mockDeleteFromCloudinary.mockReset();
    mockCloudinaryDestroy.mockReset();
    mockCloudinaryDestroy.mockResolvedValue({ result: "ok" });
    mockDeleteFromCloudinary.mockResolvedValue({ result: "ok" });

    freeUser = await User.create({
        name: "Free User", email: "free@test.com",
        password: "password123", authProvider: "local", role: "free",
    });
    proUser = await User.create({
        name: "Pro User", email: "pro@test.com",
        password: "password123", authProvider: "local", role: "pro",
    });
    adminUser = await User.create({
        name: "Admin User", email: "admin@test.com",
        password: "password123", authProvider: "local", role: "admin",
    });
});

// ============================================
// getAllMusic Tests
// ============================================
describe("getAllMusic", () => {
    describe("Guest Mode — no user", () => {
        it("should return only system music (userId: null)", async () => {
            await Music.create([
                { name: "System Song", type: "music", userId: null },
                { name: "User Song", type: "music", userId: freeUser._id },
            ]);

            const req = mockRequest({ user: null });
            const res = mockResponse();
            await getAllMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const body = res.json.mock.calls[0][0];
            expect(body.success).toBe(true);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe("System Song");
        });

        it("should set isOwner=false and isFavorite=false for guest", async () => {
            await Music.create({ name: "Song", userId: null });
            const req = mockRequest({ user: null });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data[0].isOwner).toBe(false);
            expect(body.data[0].isFavorite).toBe(false);
        });

        it("should return userMusicCount=0 and maxSongs=0", async () => {
            const req = mockRequest({ user: null });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.userMusicCount).toBe(0);
            expect(body.maxSongs).toBe(0);
        });
    });

    describe("Authenticated User", () => {
        it("should return system music + user's personal music", async () => {
            await Music.create([
                { name: "System", userId: null },
                { name: "My Song", userId: freeUser._id },
                { name: "Other Song", userId: proUser._id },
            ]);

            const req = mockRequest({ user: freeUser });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data).toHaveLength(2); // system + own, NOT other user's
            const names = body.data.map(m => m.name);
            expect(names).toContain("System");
            expect(names).toContain("My Song");
            expect(names).not.toContain("Other Song");
        });

        it("should mark isOwner=true for user's own music", async () => {
            await Music.create({ name: "My Song", userId: freeUser._id });
            const req = mockRequest({ user: freeUser });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data[0].isOwner).toBe(true);
        });

        it("should mark isFavorite=true if user is in favoritedBy", async () => {
            await Music.create({ name: "Fav Song", userId: null, favoritedBy: [freeUser._id] });
            const req = mockRequest({ user: freeUser });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data[0].isFavorite).toBe(true);
        });

        it("should return correct userMusicCount and maxSongs for free user", async () => {
            await Music.create({ name: "My Song", userId: freeUser._id });
            const req = mockRequest({ user: freeUser });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.userMusicCount).toBe(1);
            expect(body.maxSongs).toBe(1);
        });

        it("should return maxSongs=15 for pro user", async () => {
            const req = mockRequest({ user: proUser });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.maxSongs).toBe(15);
        });
    });

    describe("Filters", () => {
        beforeEach(async () => {
            await Music.create([
                { name: "Music Chill", type: "music", category: "chill", userId: null },
                { name: "SFX Other", type: "sfx", category: "other", userId: null },
                { name: "Music Energetic", type: "music", category: "energetic", userId: null },
            ]);
        });

        it("should filter by type", async () => {
            const req = mockRequest({ user: null, query: { type: "sfx" } });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe("SFX Other");
        });

        it("should filter by category", async () => {
            const req = mockRequest({ user: null, query: { category: "chill" } });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe("Music Chill");
        });

        it("should filter by both type and category", async () => {
            const req = mockRequest({ user: null, query: { type: "music", category: "energetic" } });
            const res = mockResponse();
            await getAllMusic(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe("Music Energetic");
        });
    });
});

// ============================================
// getMusicById Tests
// ============================================
describe("getMusicById", () => {
    it("should return music by valid ID", async () => {
        const song = await Music.create({ name: "Test Song", userId: null });
        const req = mockRequest({ params: { id: song._id } });
        const res = mockResponse();
        await getMusicById(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.name).toBe("Test Song");
    });

    it("should return 404 for non-existent ID", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const req = mockRequest({ params: { id: fakeId } });
        const res = mockResponse();
        await getMusicById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 500 on invalid ID format", async () => {
        const req = mockRequest({ params: { id: "invalid-id" } });
        const res = mockResponse();
        await getMusicById(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ============================================
// addMusic Tests
// ============================================
describe("addMusic", () => {
    it("should create music with all fields", async () => {
        const req = mockRequest({
            body: { name: "New Song", icon: "🎸", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/test.mp3" },
        });
        const res = mockResponse();
        await addMusic(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const data = res.json.mock.calls[0][0].data;
        expect(data.name).toBe("New Song");
        expect(data.icon).toBe("🎸");
        expect(data.category).toBe("energetic");
    });

    it("should return 400 when name is missing", async () => {
        const req = mockRequest({ body: {} });
        const res = mockResponse();
        await addMusic(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should extract youtubeId from externalUrl", async () => {
        const req = mockRequest({
            body: { name: "YT Song", sourceType: "url", externalUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
        });
        const res = mockResponse();
        await addMusic(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0].data.youtubeId).toBe("dQw4w9WgXcQ");
    });

    it("should use defaults for optional fields", async () => {
        const req = mockRequest({ body: { name: "Minimal Song" } });
        const res = mockResponse();
        await addMusic(req, res);

        const data = res.json.mock.calls[0][0].data;
        expect(data.icon).toBe("🎵");
        expect(data.category).toBe("other");
        expect(data.type).toBe("music");
    });
});

// ============================================
// previewYouTube Tests
// ============================================
describe("previewYouTube", () => {
    it("should return video info with needTrim=false when short", async () => {
        mockGetVideoInfo.mockResolvedValue({
            title: "Short Song", duration: 180, thumbnail: "https://img.youtube.com/vi/abc/hqdefault.jpg",
            videoId: "abc123", channel: "Test Channel",
        });

        const req = mockRequest({ body: { youtubeUrl: "https://youtube.com/watch?v=abc123" } });
        const res = mockResponse();
        await previewYouTube(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.data.needTrim).toBe(false);
        expect(body.data.maxDuration).toBe(300);
    });

    it("should set needTrim=true when duration > 300s", async () => {
        mockGetVideoInfo.mockResolvedValue({
            title: "Long Song", duration: 600, thumbnail: "thumb.jpg", videoId: "xyz", channel: "Ch",
        });

        const req = mockRequest({ body: { youtubeUrl: "https://youtube.com/watch?v=xyz" } });
        const res = mockResponse();
        await previewYouTube(req, res);

        expect(res.json.mock.calls[0][0].data.needTrim).toBe(true);
    });

    it("should return 400 when URL is missing", async () => {
        const req = mockRequest({ body: {} });
        const res = mockResponse();
        await previewYouTube(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 on getVideoInfo error", async () => {
        mockGetVideoInfo.mockRejectedValue(new Error("URL YouTube không hợp lệ"));

        const req = mockRequest({ body: { youtubeUrl: "invalid" } });
        const res = mockResponse();
        await previewYouTube(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

// ============================================
// addFromYouTube Tests
// ============================================
describe("addFromYouTube", () => {
    const ytResult = {
        url: "https://res.cloudinary.com/test/video/upload/todoz-music/music_123.mp3",
        publicId: "todoz-music/music_123",
        title: "Test Song",
        duration: 200,
        thumbnail: "https://img.youtube.com/vi/abc123/hqdefault.jpg",
        videoId: "abc123",
    };

    beforeEach(() => {
        mockExtractAndUpload.mockResolvedValue(ytResult);
    });

    describe("Validation", () => {
        it("should return 400 when URL is missing", async () => {
            const req = mockRequest({ user: freeUser, body: {} });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe("Tier Limits", () => {
        it("should reject when free user reaches 1 song limit", async () => {
            // Already has 1 song
            await Music.create({ name: "Existing", userId: freeUser._id, youtubeId: "existing" });

            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=new123" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            const body = res.json.mock.calls[0][0];
            expect(body.message).toContain("Free");
        });

        it("should reject when pro user reaches 15 song limit", async () => {
            // Create 15 songs
            const songs = Array.from({ length: 15 }, (_, i) => ({
                name: `Song ${i}`, userId: proUser._id, youtubeId: `yt${i}`,
            }));
            await Music.insertMany(songs);

            const req = mockRequest({
                user: proUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=newPro" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it("should allow free user to add first song", async () => {
            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe("Duplicate Detection", () => {
        it("should return 409 when same YouTube video already added by user", async () => {
            await Music.create({ name: "Existing", userId: proUser._id, youtubeId: "abc123" });

            const req = mockRequest({
                user: proUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
        });

        it("should allow same video from different user", async () => {
            await Music.create({ name: "Existing", userId: proUser._id, youtubeId: "abc123" });

            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe("Success", () => {
        it("should create music from YouTube with all fields", async () => {
            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123", category: "chill" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            const body = res.json.mock.calls[0][0];
            expect(body.data.externalUrl).toBe(ytResult.url);
            expect(body.data.cloudinaryId).toBe(ytResult.publicId);
            expect(body.data.thumbnail).toBe(ytResult.thumbnail);
            expect(body.data.duration).toBe(200);
            expect(body.data.category).toBe("chill");
        });

        it("should use custom name if provided", async () => {
            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123", name: "My Custom Name" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.json.mock.calls[0][0].data.name).toBe("My Custom Name");
        });

        it("should use customThumbnail over YouTube thumbnail", async () => {
            const customThumb = "https://res.cloudinary.com/test/todoz-music-avatars/temp_123.webp";
            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123", customThumbnail: customThumb },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.json.mock.calls[0][0].data.thumbnail).toBe(customThumb);
        });

        it("should set isOwner=true and isFavorite=false in response", async () => {
            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=abc123" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            const body = res.json.mock.calls[0][0];
            expect(body.data.isOwner).toBe(true);
            expect(body.data.isFavorite).toBe(false);
            expect(body.userMusicCount).toBe(1);
            expect(body.maxSongs).toBe(1);
        });
    });

    describe("Error — needTrim", () => {
        it("should return needTrim info when video too long", async () => {
            const trimError = new Error("Bài hát dài hơn 5 phút");
            trimError.needTrim = true;
            trimError.duration = 600;
            trimError.title = "Long Video";
            trimError.thumbnail = "thumb.jpg";
            trimError.videoId = "longvid";
            mockExtractAndUpload.mockRejectedValue(trimError);

            const req = mockRequest({
                user: freeUser,
                body: { youtubeUrl: "https://youtube.com/watch?v=longvid" },
            });
            const res = mockResponse();
            await addFromYouTube(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            const body = res.json.mock.calls[0][0];
            expect(body.needTrim).toBe(true);
            expect(body.duration).toBe(600);
            expect(body.title).toBe("Long Video");
        });
    });
});

// ============================================
// updateMusic Tests
// ============================================
describe("updateMusic", () => {
    let userSong;

    beforeEach(async () => {
        userSong = await Music.create({
            name: "Original Song", icon: "🎵", category: "chill",
            userId: freeUser._id, thumbnail: null,
        });
    });

    describe("Authorization", () => {
        it("should return 404 for non-existent music", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const req = mockRequest({ user: freeUser, params: { id: fakeId }, body: { name: "X" } });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("should return 403 when non-owner tries to update", async () => {
            const req = mockRequest({ user: proUser, params: { id: userSong._id }, body: { name: "Hacked" } });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it("should allow owner to update", async () => {
            const req = mockRequest({ user: freeUser, params: { id: userSong._id }, body: { name: "Updated" } });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json.mock.calls[0][0].data.name).toBe("Updated");
        });

        it("should allow admin to update any music", async () => {
            const req = mockRequest({ user: adminUser, params: { id: userSong._id }, body: { name: "Admin Edit" } });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json.mock.calls[0][0].data.name).toBe("Admin Edit");
        });
    });

    describe("Field Updates", () => {
        it("should update name only", async () => {
            const req = mockRequest({ user: freeUser, params: { id: userSong._id }, body: { name: "New Name" } });
            const res = mockResponse();
            await updateMusic(req, res);

            const data = res.json.mock.calls[0][0].data;
            expect(data.name).toBe("New Name");
            expect(data.category).toBe("chill"); // unchanged
        });

        it("should update category only", async () => {
            const req = mockRequest({ user: freeUser, params: { id: userSong._id }, body: { category: "energetic" } });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.json.mock.calls[0][0].data.category).toBe("energetic");
        });

        it("should update thumbnail and delete old Cloudinary thumbnail", async () => {
            // Set old thumbnail as Cloudinary URL
            const oldThumb = "https://res.cloudinary.com/dmsefbjuk/image/upload/todoz-music-avatars/music_abc123.webp";
            await Music.findByIdAndUpdate(userSong._id, { thumbnail: oldThumb });

            const newThumb = "https://res.cloudinary.com/dmsefbjuk/image/upload/todoz-music-avatars/music_def456.webp";
            const req = mockRequest({
                user: freeUser, params: { id: userSong._id },
                body: { thumbnail: newThumb },
            });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // Verify old thumbnail was deleted from Cloudinary
            expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
                "todoz-music-avatars/music_abc123",
                { resource_type: "image" }
            );
        });

        it("should NOT delete old thumbnail if it's from YouTube CDN", async () => {
            const ytThumb = "https://img.youtube.com/vi/abc123/hqdefault.jpg";
            await Music.findByIdAndUpdate(userSong._id, { thumbnail: ytThumb });

            const req = mockRequest({
                user: freeUser, params: { id: userSong._id },
                body: { thumbnail: null }, // switching to emoji
            });
            const res = mockResponse();
            await updateMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // YouTube CDN thumbnail should NOT trigger Cloudinary destroy
            expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
        });

        it("should set isOwner and isFavorite in response", async () => {
            const req = mockRequest({ user: freeUser, params: { id: userSong._id }, body: { name: "X" } });
            const res = mockResponse();
            await updateMusic(req, res);

            const data = res.json.mock.calls[0][0].data;
            expect(data.isOwner).toBe(true);
            expect(data.isFavorite).toBe(false);
        });
    });
});

// ============================================
// deleteMusic Tests
// ============================================
describe("deleteMusic", () => {
    describe("Authorization", () => {
        it("should return 404 for non-existent music", async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const req = mockRequest({ user: freeUser, params: { id: fakeId } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("should return 403 for non-admin on system music", async () => {
            const systemSong = await Music.create({ name: "System", userId: null });
            const req = mockRequest({ user: freeUser, params: { id: systemSong._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json.mock.calls[0][0].message).toContain("hệ thống");
        });

        it("should return 403 for non-owner on user music", async () => {
            const otherSong = await Music.create({ name: "Other's Song", userId: proUser._id });
            const req = mockRequest({ user: freeUser, params: { id: otherSong._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it("should allow owner to delete own music", async () => {
            const mySong = await Music.create({ name: "My Song", userId: freeUser._id });
            const req = mockRequest({ user: freeUser, params: { id: mySong._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const deleted = await Music.findById(mySong._id);
            expect(deleted).toBeNull();
        });

        it("should allow admin to delete any user music", async () => {
            const userSong = await Music.create({ name: "User Song", userId: freeUser._id });
            const req = mockRequest({ user: adminUser, params: { id: userSong._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it("should allow admin to delete system music", async () => {
            const sysSong = await Music.create({ name: "System", userId: null });
            const req = mockRequest({ user: adminUser, params: { id: sysSong._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("Cloudinary Cleanup", () => {
        it("should delete audio from Cloudinary via deleteFromCloudinary", async () => {
            const song = await Music.create({
                name: "Song", userId: freeUser._id,
                cloudinaryId: "todoz-music/music_123_abc_456",
            });
            const req = mockRequest({ user: freeUser, params: { id: song._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(mockDeleteFromCloudinary).toHaveBeenCalledWith("todoz-music/music_123_abc_456");
        });

        it("should delete custom thumbnail from Cloudinary", async () => {
            const song = await Music.create({
                name: "Song", userId: freeUser._id,
                thumbnail: "https://res.cloudinary.com/dmsefbjuk/image/upload/todoz-music-avatars/music_abc.webp",
            });
            const req = mockRequest({ user: freeUser, params: { id: song._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
                "todoz-music-avatars/music_abc",
                { resource_type: "image" }
            );
        });

        it("should NOT call cloudinary destroy for YouTube CDN thumbnail", async () => {
            const song = await Music.create({
                name: "Song", userId: freeUser._id,
                thumbnail: "https://img.youtube.com/vi/abc123/hqdefault.jpg",
            });
            const req = mockRequest({ user: freeUser, params: { id: song._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
        });

        it("should handle missing cloudinaryId gracefully", async () => {
            const song = await Music.create({
                name: "Song", userId: freeUser._id,
                cloudinaryId: null, thumbnail: null,
            });
            const req = mockRequest({ user: freeUser, params: { id: song._id } });
            const res = mockResponse();
            await deleteMusic(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(mockDeleteFromCloudinary).not.toHaveBeenCalled();
            expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
        });
    });
});

// ============================================
// deleteCustomThumbnail Tests
// ============================================
describe("deleteCustomThumbnail", () => {
    it("should skip when URL is null", async () => {
        await deleteCustomThumbnail(null);
        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });

    it("should skip when URL is empty string", async () => {
        await deleteCustomThumbnail("");
        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });

    it("should skip for YouTube CDN URLs", async () => {
        await deleteCustomThumbnail("https://img.youtube.com/vi/abc/hqdefault.jpg");
        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });

    it("should skip for Cloudinary URL without todoz-music-avatars folder", async () => {
        await deleteCustomThumbnail("https://res.cloudinary.com/test/image/upload/todoz-avatars/avatar_123.webp");
        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });

    it("should delete Cloudinary URL with todoz-music-avatars folder", async () => {
        await deleteCustomThumbnail(
            "https://res.cloudinary.com/dmsefbjuk/image/upload/v1234/todoz-music-avatars/music_abc123.webp"
        );
        expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
            "todoz-music-avatars/music_abc123",
            { resource_type: "image" }
        );
    });

    it("should delete temp thumbnail uploads", async () => {
        await deleteCustomThumbnail(
            "https://res.cloudinary.com/dmsefbjuk/image/upload/todoz-music-avatars/temp_user1_1709300000.webp"
        );
        expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
            "todoz-music-avatars/temp_user1_1709300000",
            { resource_type: "image" }
        );
    });

    it("should handle cloudinary error gracefully (not throw)", async () => {
        mockCloudinaryDestroy.mockRejectedValue(new Error("Cloudinary down"));
        await expect(
            deleteCustomThumbnail("https://res.cloudinary.com/test/image/upload/todoz-music-avatars/music_x.webp")
        ).resolves.toBeUndefined();
    });
});

// ============================================
// toggleFavorite Tests
// ============================================
describe("toggleFavorite", () => {
    it("should add user to favoritedBy when not favorited", async () => {
        const song = await Music.create({ name: "Song", userId: null, favoritedBy: [] });
        const req = mockRequest({ user: freeUser, params: { id: song._id } });
        const res = mockResponse();
        await toggleFavorite(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.isFavorite).toBe(true);
    });

    it("should remove user from favoritedBy when already favorited", async () => {
        const song = await Music.create({ name: "Song", userId: null, favoritedBy: [freeUser._id] });
        const req = mockRequest({ user: freeUser, params: { id: song._id } });
        const res = mockResponse();
        await toggleFavorite(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.isFavorite).toBe(false);
    });

    it("should return 404 for non-existent music", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const req = mockRequest({ user: freeUser, params: { id: fakeId } });
        const res = mockResponse();
        await toggleFavorite(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should correctly set isOwner flag", async () => {
        const song = await Music.create({ name: "Song", userId: freeUser._id, favoritedBy: [] });
        const req = mockRequest({ user: freeUser, params: { id: song._id } });
        const res = mockResponse();
        await toggleFavorite(req, res);

        expect(res.json.mock.calls[0][0].data.isOwner).toBe(true);
    });
});

// ============================================
// incrementPlayCount Tests
// ============================================
describe("incrementPlayCount", () => {
    it("should increment playCount by 1", async () => {
        const song = await Music.create({ name: "Song", userId: null, playCount: 5 });
        const req = mockRequest({ params: { id: song._id } });
        const res = mockResponse();
        await incrementPlayCount(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.playCount).toBe(6);
    });

    it("should return 404 for non-existent music", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const req = mockRequest({ params: { id: fakeId } });
        const res = mockResponse();
        await incrementPlayCount(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

// ============================================
// seedMusic Tests
// ============================================
describe("seedMusic", () => {
    it("should seed initial music data when DB is empty", async () => {
        const req = mockRequest();
        const res = mockResponse();
        await seedMusic(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const body = res.json.mock.calls[0][0];
        expect(body.count).toBe(15); // 13 music + 2 sfx
    });

    it("should skip seeding when music already exists", async () => {
        await Music.create({ name: "Existing" });
        const req = mockRequest();
        const res = mockResponse();
        await seedMusic(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].message).toContain("already exists");
    });
});
