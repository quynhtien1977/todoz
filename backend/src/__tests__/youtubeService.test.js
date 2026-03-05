/**
 * Unit Tests for YouTube Service
 * Tests: getVideoInfo, extractAndUpload, deleteFromCloudinary
 * Also tests internal helpers via exported functions: URL validation, cleanTitle
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ==================== ESM Mocking ====================
const mockYoutubedl = jest.fn();
const mockFsExistsSync = jest.fn();
const mockFsUnlinkSync = jest.fn();
const mockCloudinaryUpload = jest.fn();
const mockCloudinaryDestroy = jest.fn();

jest.unstable_mockModule("youtube-dl-exec", () => ({
    default: mockYoutubedl,
}));

jest.unstable_mockModule("ffmpeg-static", () => ({
    default: "/fake/path/to/ffmpeg",
}));

jest.unstable_mockModule("fs", () => ({
    default: {
        existsSync: mockFsExistsSync,
        unlinkSync: mockFsUnlinkSync,
    },
    existsSync: mockFsExistsSync,
    unlinkSync: mockFsUnlinkSync,
}));

jest.unstable_mockModule("../config/cloudinary.js", () => ({
    default: {
        uploader: {
            upload: mockCloudinaryUpload,
            destroy: mockCloudinaryDestroy,
        },
    },
}));

const { extractAndUpload, getVideoInfo, deleteFromCloudinary } =
    await import("../utils/youtubeService.js");

// ==================== Setup ====================
beforeEach(() => {
    mockYoutubedl.mockReset();
    mockFsExistsSync.mockReset();
    mockFsUnlinkSync.mockReset();
    mockCloudinaryUpload.mockReset();
    mockCloudinaryDestroy.mockReset();
});

// ============================================
// getVideoInfo Tests
// ============================================
describe("getVideoInfo", () => {
    it("should return parsed video info for valid URL", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
            duration: 212,
            thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            id: "dQw4w9WgXcQ",
            channel: "Rick Astley",
        });

        const info = await getVideoInfo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

        expect(info.title).toBe("Rick Astley - Never Gonna Give You Up");
        expect(info.duration).toBe(212);
        expect(info.videoId).toBe("dQw4w9WgXcQ");
        expect(info.channel).toBe("Rick Astley");
    });

    it("should throw for invalid URL", async () => {
        await expect(getVideoInfo("not-a-url")).rejects.toThrow("URL YouTube không hợp lệ");
    });

    it("should accept youtu.be short URLs", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Test", duration: 100, thumbnail: "thumb.jpg",
            id: "abc123", channel: "Channel",
        });

        const info = await getVideoInfo("https://youtu.be/abc123");
        expect(info.videoId).toBe("abc123");
    });

    it("should accept YouTube Shorts URLs", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Short", duration: 30, thumbnail: "t.jpg",
            id: "xyz789", channel: "Ch",
        });

        const info = await getVideoInfo("https://youtube.com/shorts/xyz789");
        expect(info.videoId).toBe("xyz789");
    });

    it("should accept YouTube Music URLs", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Music", duration: 180, thumbnail: "t.jpg",
            id: "mus999", channel: "Artist",
        });

        const info = await getVideoInfo("https://music.youtube.com/watch?v=mus999");
        expect(info.videoId).toBe("mus999");
    });

    it("should fallback to default thumbnail if missing", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Test", duration: 100, thumbnail: null,
            id: "abc123", channel: "Ch",
        });

        const info = await getVideoInfo("https://youtube.com/watch?v=abc123");
        expect(info.thumbnail).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
    });

    it("should fallback to 0 for unparseable duration", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Test", duration: null, thumbnail: "t.jpg",
            id: "abc", channel: "Ch",
        });

        const info = await getVideoInfo("https://youtube.com/watch?v=abc");
        expect(info.duration).toBe(0);
    });

    it("should use uploader if channel is missing", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Test", duration: 100, thumbnail: "t.jpg",
            id: "abc", channel: null, uploader: "Up Person",
        });

        const info = await getVideoInfo("https://youtube.com/watch?v=abc");
        expect(info.channel).toBe("Up Person");
    });

    it("should call youtube-dl-exec with correct options", async () => {
        mockYoutubedl.mockResolvedValue({
            title: "Test", duration: 100, thumbnail: "t.jpg",
            id: "abc", channel: "Ch",
        });

        await getVideoInfo("https://youtube.com/watch?v=abc");

        expect(mockYoutubedl).toHaveBeenCalledWith(
            "https://youtube.com/watch?v=abc",
            expect.objectContaining({
                dumpSingleJson: true,
                noDownload: true,
                noPlaylist: true,
            })
        );
    });
});

// ============================================
// extractAndUpload Tests
// ============================================
describe("extractAndUpload", () => {
    const validUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    const userId = "user123";

    beforeEach(() => {
        // Default: getVideoInfo returns short-duration info
        mockYoutubedl
            .mockResolvedValueOnce({
                title: "Test Song (Official Video)",
                duration: 180,
                thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                id: "dQw4w9WgXcQ",
                channel: "Artist",
            })
            // Second call is the download
            .mockResolvedValueOnce(undefined);

        mockFsExistsSync.mockReturnValue(true);
        mockCloudinaryUpload.mockResolvedValue({
            secure_url: "https://res.cloudinary.com/test/video/upload/todoz-music/music_123.mp3",
            public_id: "todoz-music/music_user123_dQw4w9WgXcQ_123",
        });
    });

    describe("Validation", () => {
        it("should throw for invalid URL", async () => {
            await expect(extractAndUpload("not-a-url", userId))
                .rejects.toThrow("URL YouTube không hợp lệ");
        });
    });

    describe("Duration Limits", () => {
        it("should throw needTrim error for video > 5 minutes without trim options", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Long Video", duration: 600,
                thumbnail: "t.jpg", id: "long123", channel: "Ch",
            });

            try {
                await extractAndUpload(validUrl, userId);
                expect(true).toBe(false); // should not reach
            } catch (error) {
                expect(error.needTrim).toBe(true);
                expect(error.duration).toBe(600);
                expect(error.title).toBeDefined();
                expect(error.thumbnail).toBeDefined();
                expect(error.videoId).toBeDefined();
            }
        });

        it("should allow > 5min video when trim options are provided", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl
                .mockResolvedValueOnce({
                    title: "Long Video", duration: 600,
                    thumbnail: "t.jpg", id: "long123", channel: "Ch",
                })
                .mockResolvedValueOnce(undefined);

            mockFsExistsSync.mockReturnValue(true);
            mockCloudinaryUpload.mockResolvedValue({
                secure_url: "https://res.cloudinary.com/test/video/upload/todoz-music/music_long.mp3",
                public_id: "todoz-music/music_long",
            });

            const result = await extractAndUpload(validUrl, userId, { startTime: 0, endTime: 120 });
            expect(result.duration).toBe(120);
        });

        it("should throw if trim range exceeds 5 minutes", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Long Video", duration: 600,
                thumbnail: "t.jpg", id: "long123", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: 0, endTime: 400 })
            ).rejects.toThrow("không được dài hơn");
        });

        it("should throw if startTime < 0", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: -1, endTime: 100 })
            ).rejects.toThrow("không hợp lệ");
        });

        it("should throw if endTime exceeds duration", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: 0, endTime: 300 })
            ).rejects.toThrow("không hợp lệ");
        });

        it("should throw if endTime <= startTime (reversed range)", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: 100, endTime: 50 })
            ).rejects.toThrow("Thời gian kết thúc phải lớn hơn thời gian bắt đầu");
        });

        it("should throw if startTime equals endTime", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: 60, endTime: 60 })
            ).rejects.toThrow("Thời gian kết thúc phải lớn hơn thời gian bắt đầu");
        });

        it("should treat null params as no trimming (require trim for long video)", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Long Video", duration: 600,
                thumbnail: "t.jpg", id: "long123", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: null, endTime: null })
            ).rejects.toThrow("Vui lòng chọn đoạn muốn cắt");
        });

        it("should treat empty string params as no trimming (require trim for long video)", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Long Video", duration: 600,
                thumbnail: "t.jpg", id: "long123", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: "", endTime: "" })
            ).rejects.toThrow("Vui lòng chọn đoạn muốn cắt");
        });

        it("should accept string number params as valid trimming", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Long Video", duration: 600,
                thumbnail: "t.jpg", id: "long123", channel: "Ch",
            });
            mockYoutubedl.mockResolvedValueOnce(undefined);

            const result = await extractAndUpload(validUrl, userId, { startTime: "10", endTime: "120" });
            expect(result.duration).toBe(110);
        });

        it("should throw if only startTime is provided without endTime", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: 30 })
            ).rejects.toThrow("Thời gian cắt không hợp lệ");
        });

        it("should throw if only endTime is provided without startTime", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { endTime: 120 })
            ).rejects.toThrow("Thời gian cắt không hợp lệ");
        });

        it("should throw if trim params are non-numeric strings", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Video", duration: 200,
                thumbnail: "t.jpg", id: "vid", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: "abc", endTime: "xyz" })
            ).rejects.toThrow("Thời gian cắt không hợp lệ");
        });

        it("should treat whitespace-only params as no trimming (require trim for long video)", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl.mockResolvedValueOnce({
                title: "Long Video", duration: 600,
                thumbnail: "t.jpg", id: "long123", channel: "Ch",
            });

            await expect(
                extractAndUpload(validUrl, userId, { startTime: "   ", endTime: "   " })
            ).rejects.toThrow("Vui lòng chọn đoạn muốn cắt");
        });
    });

    describe("Download & Upload", () => {
        it("should download and upload successfully", async () => {
            const result = await extractAndUpload(validUrl, userId);

            expect(result.url).toContain("cloudinary.com");
            expect(result.publicId).toContain("todoz-music");
            expect(result.title).toBe("Test Song");
            expect(result.duration).toBe(180);
            expect(result.thumbnail).toContain("ytimg.com");
            expect(result.videoId).toBe("dQw4w9WgXcQ");
        });

        it("should throw if mp3 file not found after download", async () => {
            mockFsExistsSync.mockReturnValue(false);

            await expect(extractAndUpload(validUrl, userId))
                .rejects.toThrow("Không thể tải audio");
        });

        it("should cleanup temp file after upload", async () => {
            await extractAndUpload(validUrl, userId);

            expect(mockFsUnlinkSync).toHaveBeenCalled();
        });

        it("should cleanup temp file even if upload fails", async () => {
            mockCloudinaryUpload.mockRejectedValue(new Error("Upload failed"));

            await expect(extractAndUpload(validUrl, userId)).rejects.toThrow("Upload failed");
            expect(mockFsUnlinkSync).toHaveBeenCalled();
        });

        it("should include postprocessorArgs when trimming", async () => {
            mockYoutubedl.mockReset();
            mockYoutubedl
                .mockResolvedValueOnce({
                    title: "Video", duration: 200,
                    thumbnail: "t.jpg", id: "vid", channel: "Ch",
                })
                .mockResolvedValueOnce(undefined);

            await extractAndUpload(validUrl, userId, { startTime: 10, endTime: 60 });

            // Second call (download) should have postprocessorArgs
            const downloadCall = mockYoutubedl.mock.calls[1];
            expect(downloadCall[1].postprocessorArgs).toContain("-ss 10");
            expect(downloadCall[1].postprocessorArgs).toContain("-to 60");
        });

        it("should upload to Cloudinary with correct params", async () => {
            await extractAndUpload(validUrl, userId);

            expect(mockCloudinaryUpload).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    folder: "todoz-music",
                    resource_type: "video",
                    overwrite: true,
                })
            );
        });
    });

    describe("cleanTitle (via extractAndUpload)", () => {
        const testCleanTitle = async (inputTitle, expectedOutput) => {
            mockYoutubedl.mockReset();
            mockYoutubedl
                .mockResolvedValueOnce({
                    title: inputTitle, duration: 100,
                    thumbnail: "t.jpg", id: "vid", channel: "Ch",
                })
                .mockResolvedValueOnce(undefined);
            mockFsExistsSync.mockReturnValue(true);
            mockCloudinaryUpload.mockResolvedValue({
                secure_url: "https://res.cloudinary.com/test/x.mp3",
                public_id: "todoz-music/x",
            });

            const result = await extractAndUpload(validUrl, userId);
            expect(result.title).toBe(expectedOutput);
        };

        it("should remove (Official Music Video)", async () => {
            await testCleanTitle("Song (Official Music Video)", "Song");
        });

        it("should remove [Official Video]", async () => {
            await testCleanTitle("Song [Official Video]", "Song");
        });

        it("should remove (Lyrics Video)", async () => {
            await testCleanTitle("Song (Lyrics Video)", "Song");
        });

        it("should remove [Lyrics]", async () => {
            await testCleanTitle("Song [Lyrics]", "Song");
        });

        it("should remove (Audio)", async () => {
            await testCleanTitle("Song (Audio)", "Song");
        });

        it("should remove (MV)", async () => {
            await testCleanTitle("Song (MV)", "Song");
        });

        it("should remove trailing | artist info", async () => {
            await testCleanTitle("Song | Official Audio | Artist", "Song");
        });

        it("should collapse multiple spaces", async () => {
            await testCleanTitle("Song   (Official Video)   Extra", "Song Extra");
        });
    });
});

// ============================================
// deleteFromCloudinary Tests
// ============================================
describe("deleteFromCloudinary", () => {
    it("should call cloudinary.uploader.destroy with video resource_type", async () => {
        mockCloudinaryDestroy.mockResolvedValue({ result: "ok" });

        const result = await deleteFromCloudinary("todoz-music/music_123_abc_456");

        expect(mockCloudinaryDestroy).toHaveBeenCalledWith(
            "todoz-music/music_123_abc_456",
            { resource_type: "video" }
        );
        expect(result.result).toBe("ok");
    });

    it("should return null when publicId is null", async () => {
        const result = await deleteFromCloudinary(null);

        expect(result).toBeNull();
        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });

    it("should return null when publicId is empty string", async () => {
        const result = await deleteFromCloudinary("");

        expect(result).toBeNull();
        expect(mockCloudinaryDestroy).not.toHaveBeenCalled();
    });

    it("should return null and not throw on Cloudinary error", async () => {
        mockCloudinaryDestroy.mockRejectedValue(new Error("Network error"));

        const result = await deleteFromCloudinary("todoz-music/music_abc");

        expect(result).toBeNull();
    });
});
