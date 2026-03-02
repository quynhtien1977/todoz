import Music from "../models/Music.js";
import { extractAndUpload, getVideoInfo, deleteFromCloudinary } from "../utils/youtubeService.js";

// Tier limits
const TIER_LIMITS = {
    free: { maxSongs: 1 },
    pro: { maxSongs: 15 },
    admin: { maxSongs: 999 },
};
const MAX_DURATION = 5 * 60; // 300 seconds = 5 phút

// Lấy tất cả nhạc (system + nhạc cá nhân của user)
export const getAllMusic = async (req, res) => {
    try {
        const { type, category } = req.query;
        const userId = req.user?._id;

        // System music (userId: null) + nhạc cá nhân (nếu đã login)
        const filter = userId
            ? { $or: [{ userId: null }, { userId }] }
            : { userId: null };
        
        if (type) filter.type = type;
        if (category) filter.category = category;
        
        const music = await Music.find(filter).sort({ createdAt: -1 }).lean();

        // Đánh dấu isOwner + isFavorite per-user
        const data = music.map(m => ({
            ...m,
            isOwner: userId ? m.userId?.toString() === userId.toString() : false,
            isFavorite: userId ? (m.favoritedBy || []).some(id => id.toString() === userId.toString()) : false,
        }));

        // Đếm số nhạc cá nhân của user
        const userMusicCount = userId
            ? data.filter(m => m.isOwner).length
            : 0;
        const maxSongs = userId
            ? (TIER_LIMITS[req.user.role] || TIER_LIMITS.free).maxSongs
            : 0;

        res.status(200).json({ 
            success: true, 
            data,
            userMusicCount,
            maxSongs,
        });
    } catch (error) {
        console.error("Error fetching music:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Lấy một bài nhạc theo ID
export const getMusicById = async (req, res) => {
    try {
        const music = await Music.findById(req.params.id);
        if (!music) {
            return res.status(404).json({ success: false, message: "Music not found" });
        }
        res.status(200).json({ success: true, data: music });
    } catch (error) {
        console.error("Error fetching music:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Thêm nhạc mới (local hoặc URL) — dùng cho admin/seed
export const addMusic = async (req, res) => {
    try {
        const { name, icon, category, type, sourceType, localPath, externalUrl } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }
        
        let youtubeId = null;
        if (sourceType === 'url' && externalUrl) {
            youtubeId = extractYoutubeId(externalUrl);
        }
        
        const newMusic = new Music({
            name,
            icon: icon || "🎵",
            category: category || "other",
            type: type || "music",
            sourceType: sourceType || "local",
            localPath,
            externalUrl,
            youtubeId
        });
        
        await newMusic.save();
        res.status(201).json({ success: true, data: newMusic });
    } catch (error) {
        console.error("Error adding music:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// ========== YouTube Integration ==========

// Preview: lấy thông tin video YouTube trước khi extract
export const previewYouTube = async (req, res) => {
    try {
        const { youtubeUrl } = req.body;
        if (!youtubeUrl) {
            return res.status(400).json({ success: false, message: "URL YouTube là bắt buộc" });
        }

        const info = await getVideoInfo(youtubeUrl);
        
        res.status(200).json({
            success: true,
            data: {
                ...info,
                needTrim: info.duration > MAX_DURATION,
                maxDuration: MAX_DURATION,
            }
        });
    } catch (error) {
        console.error("Error previewing YouTube:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// Thêm nhạc từ YouTube: extract audio → upload Cloudinary → tạo Music record
export const addFromYouTube = async (req, res) => {
    try {
        const { youtubeUrl, category, name, startTime, endTime, icon, useThumbnail, customThumbnail } = req.body;
        const userId = req.user._id;

        if (!youtubeUrl) {
            return res.status(400).json({ success: false, message: "URL YouTube là bắt buộc" });
        }

        // Check tier limit
        const userMusicCount = await Music.countDocuments({ userId });
        const maxSongs = (TIER_LIMITS[req.user.role] || TIER_LIMITS.free).maxSongs;
        
        if (userMusicCount >= maxSongs) {
            return res.status(403).json({
                success: false,
                message: req.user.role === "free"
                    ? "Tài khoản Free chỉ được thêm 1 bài. Nâng cấp PRO để thêm tối đa 15 bài!"
                    : `Đã đạt giới hạn ${maxSongs} bài.`,
                userMusicCount,
                maxSongs,
            });
        }

        // Check trùng YouTube video cho user này
        const youtubeId = extractYoutubeId(youtubeUrl);
        if (youtubeId) {
            const existing = await Music.findOne({ youtubeId, userId });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "Bạn đã thêm bài này rồi",
                    data: existing,
                });
            }
        }

        // Extract audio + upload Cloudinary
        const result = await extractAndUpload(youtubeUrl, userId.toString(), { startTime, endTime });

        // Tạo Music record
        const music = new Music({
            name: name || result.title,
            icon: icon || "🎵",
            category: category || "other",
            type: "music",
            sourceType: "url",
            externalUrl: result.url,
            youtubeId: result.videoId,
            cloudinaryId: result.publicId,
            // Xác định thumbnail: custom > youtube > null
            thumbnail: customThumbnail || (useThumbnail !== false ? result.thumbnail : null),
            duration: result.duration,
            userId,
            addedBy: userId.toString(),
        });
        await music.save();

        res.status(201).json({
            success: true,
            data: {
                ...music.toObject(),
                isOwner: true,
                isFavorite: false,
            },
            userMusicCount: userMusicCount + 1,
            maxSongs,
        });
    } catch (error) {
        console.error("Error adding from YouTube:", error);

        // Trả về needTrim nếu bài quá dài
        if (error.needTrim) {
            return res.status(400).json({
                success: false,
                message: error.message,
                needTrim: true,
                duration: error.duration,
                title: error.title,
                thumbnail: error.thumbnail,
                videoId: error.videoId,
            });
        }

        res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};

// Cập nhật nhạc (chỉ owner hoặc admin)
export const updateMusic = async (req, res) => {
    try {
        const { name, icon, category, thumbnail } = req.body;
        const music = await Music.findById(req.params.id);
        
        if (!music) {
            return res.status(404).json({ success: false, message: "Music not found" });
        }

        const userId = req.user._id;
        const isOwner = music.userId?.toString() === userId.toString();
        const isAdmin = req.user.role === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền chỉnh sửa bài này" });
        }

        // Chỉ cho phép update các field an toàn
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (icon !== undefined) updates.icon = icon;
        if (category !== undefined) updates.category = category;
        if (thumbnail !== undefined) updates.thumbnail = thumbnail || null;

        const updatedMusic = await Music.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        res.status(200).json({ 
            success: true, 
            data: {
                ...updatedMusic.toObject(),
                isOwner: true,
                isFavorite: (updatedMusic.favoritedBy || []).some(id => id.toString() === userId.toString()),
            }
        });
    } catch (error) {
        console.error("Error updating music:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Xóa nhạc — chỉ xóa nhạc cá nhân (hoặc admin xóa bất kỳ)
export const deleteMusic = async (req, res) => {
    try {
        const music = await Music.findById(req.params.id);
        if (!music) {
            return res.status(404).json({ success: false, message: "Music not found" });
        }

        const userId = req.user._id;
        const isOwner = music.userId?.toString() === userId.toString();
        const isAdmin = req.user.role === "admin";

        // Chỉ owner hoặc admin mới được xóa
        if (!music.userId && !isAdmin) {
            return res.status(403).json({ success: false, message: "Không thể xóa nhạc hệ thống" });
        }
        if (music.userId && !isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Bạn không có quyền xóa bài này" });
        }

        // Xóa file trên Cloudinary nếu có
        if (music.cloudinaryId) {
            await deleteFromCloudinary(music.cloudinaryId);
        }

        await Music.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Đã xóa bài hát" });
    } catch (error) {
        console.error("Error deleting music:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Toggle favorite (per-user: dùng favoritedBy array)
export const toggleFavorite = async (req, res) => {
    try {
        const userId = req.user._id;
        const music = await Music.findById(req.params.id);
        
        if (!music) {
            return res.status(404).json({ success: false, message: "Music not found" });
        }
        
        const index = (music.favoritedBy || []).findIndex(
            id => id.toString() === userId.toString()
        );

        if (index === -1) {
            music.favoritedBy.push(userId);
        } else {
            music.favoritedBy.splice(index, 1);
        }
        await music.save();

        res.status(200).json({ 
            success: true, 
            data: {
                ...music.toObject(),
                isFavorite: index === -1, // true nếu vừa thêm
                isOwner: music.userId?.toString() === userId.toString(),
            }
        });
    } catch (error) {
        console.error("Error toggling favorite:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Tăng play count
export const incrementPlayCount = async (req, res) => {
    try {
        const music = await Music.findByIdAndUpdate(
            req.params.id,
            { $inc: { playCount: 1 } },
            { new: true }
        );
        
        if (!music) {
            return res.status(404).json({ success: false, message: "Music not found" });
        }
        
        res.status(200).json({ success: true, data: music });
    } catch (error) {
        console.error("Error incrementing play count:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Seed initial music data từ local files
export const seedMusic = async (req, res) => {
    try {
        // Kiểm tra nếu đã có data thì không seed nữa
        const existingCount = await Music.countDocuments();
        if (existingCount > 0) {
            return res.status(200).json({ 
                success: true, 
                message: "Music data already exists", 
                count: existingCount 
            });
        }
        
        const initialMusic = [
            // Music tracks
            { name: "Bass Den Vau", icon: "🎸", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/music/bass_den_vau.mp3" },
            { name: "Basso Pem Solto", icon: "🎺", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/music/Basso_pem_solto.mp3" },
            { name: "Dam Chim", icon: "🎵", category: "chill", type: "music", sourceType: "local", localPath: "/sounds/music/Dam_chiem.mp3" },
            { name: "Eeyuh Back It Up", icon: "🔥", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/music/Eeyuh  Back It Up.mp3" },
            { name: "Giat Giat Remix", icon: "💃", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/music/Giat_giat_remix.mp3" },
            { name: "GNEDVT Remix", icon: "🎶", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/music/GNEDVT_remix.mp3" },
            { name: "Love Nwantiti", icon: "❤️", category: "international", type: "music", sourceType: "local", localPath: "/sounds/music/love+nwantiti+(tiktok+remix)+by+dj+yo!+ft+ax'el+&+ckay+(slowed+++reverb).m4a" },
            { name: "Monaluna", icon: "🌙", category: "chill", type: "music", sourceType: "local", localPath: "/sounds/music/Monaluna.mp3" },
            { name: "Naruto Theme", icon: "🍥", category: "international", type: "music", sourceType: "local", localPath: "/sounds/music/naruto.mp3" },
            { name: "Passo Bem Solto Slowed", icon: "🎧", category: "chill", type: "music", sourceType: "local", localPath: "/sounds/music/Passo_bem_solto_slowed.mp3" },
            { name: "Spiderman Feng", icon: "🕷️", category: "international", type: "music", sourceType: "local", localPath: "/sounds/music/Spiderman_feng.mp3" },
            { name: "Tek It", icon: "✨", category: "chill", type: "music", sourceType: "local", localPath: "/sounds/music/tek_it.mp3" },
            { name: "Tung Cua Remix", icon: "🚀", category: "energetic", type: "music", sourceType: "local", localPath: "/sounds/music/Tung Cua_remix.mp3" },
            
            // SFX tracks
            { name: "Alien Sound Effect", icon: "👽", category: "other", type: "sfx", sourceType: "local", localPath: "/sounds/sfx/witty-alien-brilliant-move-sound-effect.mp3" },
            { name: "The Rock Eyebrow", icon: "🤨", category: "other", type: "sfx", sourceType: "local", localPath: "/sounds/sfx/y2mate.com - Vine Boom The Rock eyebrow raise sound effect.mp3" }
        ];
        
        await Music.insertMany(initialMusic);
        
        res.status(201).json({ 
            success: true, 
            message: "Music data seeded successfully", 
            count: initialMusic.length 
        });
    } catch (error) {
        console.error("Error seeding music:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Helper: Extract YouTube ID from URL
function extractYoutubeId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
        /youtube\.com\/watch\?.*v=([^&\s]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}
