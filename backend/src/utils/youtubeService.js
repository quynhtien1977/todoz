import youtubedl from "youtube-dl-exec";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import os from "os";
import cloudinary from "../config/cloudinary.js";

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)[\w-]+/;
    return pattern.test(url);
}

/**
 * Extract YouTube video ID từ URL
 */
function extractVideoId(url) {
    const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|music\.youtube\.com\/watch\?v=)([\w-]+)/
    );
    return match ? match[1] : null;
}

/**
 * Extract audio từ YouTube URL và upload lên Cloudinary
 * Dùng youtube-dl-exec (npm, tự quản lý binary) + ffmpeg-static
 * → Hoạt động trên mọi platform, không cần cài thủ công
 */
export const extractAndUpload = async (youtubeUrl, userId, options = {}) => {
    if (!isValidYouTubeUrl(youtubeUrl)) {
        throw new Error("URL YouTube không hợp lệ");
    }

    // 1. Get video info
    const info = await getVideoInfo(youtubeUrl);
    const { title, duration, thumbnail, videoId } = info;

    // 2. Check duration limit (max 5 phút = 300s)
    const MAX_DURATION = 5 * 60;
    const { startTime, endTime } = options;
    const hasTrimmingParams = startTime !== undefined && endTime !== undefined;

    if (duration > MAX_DURATION && !hasTrimmingParams) {
        const error = new Error("Bài hát dài hơn 5 phút. Vui lòng chọn đoạn muốn cắt.");
        error.needTrim = true;
        error.duration = duration;
        error.title = title;
        error.thumbnail = thumbnail;
        error.videoId = videoId;
        throw error;
    }

    if (hasTrimmingParams) {
        if (endTime - startTime > MAX_DURATION) {
            throw new Error(`Đoạn cắt không được dài hơn ${MAX_DURATION / 60} phút`);
        }
        if (startTime < 0 || endTime > duration) {
            throw new Error("Thời gian cắt không hợp lệ");
        }
    }

    // 3. Download audio to temp file
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `todoz_${userId}_${videoId}_${Date.now()}`);
    const outputTemplate = `${tmpFile}.%(ext)s`;

    const ytOpts = {
        extractAudio: true,
        audioFormat: "mp3",
        audioQuality: 0,
        output: outputTemplate,
        noPlaylist: true,
        noWarnings: true,
        ffmpegLocation: ffmpegPath,
    };

    if (startTime !== undefined && endTime !== undefined) {
        ytOpts.postprocessorArgs = `ffmpeg:-ss ${startTime} -to ${endTime}`;
    }

    console.log("[youtubeService] Downloading audio...");
    await youtubedl(youtubeUrl, ytOpts);

    // 4. Find output mp3 file
    const mp3File = `${tmpFile}.mp3`;
    if (!fs.existsSync(mp3File)) {
        throw new Error("Không thể tải audio. Vui lòng thử lại.");
    }

    // 5. Upload to Cloudinary
    const publicId = `music_${userId}_${videoId}_${Date.now()}`;

    console.log("[youtubeService] Uploading to Cloudinary...");
    let result;
    try {
        result = await cloudinary.uploader.upload(mp3File, {
            folder: "todoz-music",
            public_id: publicId,
            resource_type: "video",
            overwrite: true,
        });
    } finally {
        try { fs.unlinkSync(mp3File); } catch { /* ignore */ }
    }

    const actualDuration = (startTime !== undefined && endTime !== undefined)
        ? (endTime - startTime)
        : Math.min(duration, MAX_DURATION);

    return {
        url: result.secure_url,
        publicId: result.public_id,
        title: cleanTitle(title),
        duration: actualDuration,
        thumbnail,
        videoId,
    };
};

/**
 * Lấy thông tin video YouTube (preview trước khi extract)
 */
export const getVideoInfo = async (youtubeUrl) => {
    if (!isValidYouTubeUrl(youtubeUrl)) {
        throw new Error("URL YouTube không hợp lệ");
    }

    const videoId = extractVideoId(youtubeUrl);

    const info = await youtubedl(youtubeUrl, {
        dumpSingleJson: true,
        noDownload: true,
        noPlaylist: true,
        noWarnings: true,
        ffmpegLocation: ffmpegPath,
    });

    return {
        title: cleanTitle(info.title || "Unknown"),
        duration: parseInt(info.duration) || 0,
        thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        videoId: videoId || info.id || "unknown",
        channel: info.channel || info.uploader || "Unknown",
    };
};

/**
 * Xóa audio file trên Cloudinary
 */
export const deleteFromCloudinary = async (publicId) => {
    if (!publicId) return null;
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: "video",
        });
        return result;
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        return null;
    }
};

// --- Helpers ---

/**
 * Clean YouTube title (bỏ ký tự thừa)
 */
function cleanTitle(title) {
    return title
        .replace(/\(Official\s*(Music\s*)?Video\)/gi, "")
        .replace(/\[Official\s*(Music\s*)?Video\]/gi, "")
        .replace(/\(Lyrics?\s*(Video)?\)/gi, "")
        .replace(/\[Lyrics?\s*(Video)?\]/gi, "")
        .replace(/\(Audio\)/gi, "")
        .replace(/\[Audio\]/gi, "")
        .replace(/\(MV\)/gi, "")
        .replace(/\[MV\]/gi, "")
        .replace(/\(4K Remaster\)/gi, "")
        .replace(/\|.*$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}
