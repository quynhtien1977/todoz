import mongoose from "mongoose";

const musicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    // Icon emoji (giữ lại cho fallback)
    icon: {
        type: String,
        default: "🎵"
    },
    // Đường dẫn file icon (VD: /icons/music/bass.png)
    iconPath: {
        type: String,
        default: null
    },
    category: {
        type: String,
        enum: ['chill', 'energetic', 'international', 'other'],
        default: 'chill'
    },
    type: {
        type: String,
        enum: ['music', 'sfx'],
        default: 'music'
    },
    // Loại source: local file hoặc URL (Cloudinary)
    sourceType: {
        type: String,
        enum: ['local', 'url'],
        default: 'local'
    },
    // Đường dẫn file local (VD: /sounds/music/song.mp3)
    localPath: {
        type: String,
        default: null
    },
    // URL từ Cloudinary (sau khi extract từ YouTube)
    externalUrl: {
        type: String,
        default: null
    },
    // YouTube video ID gốc
    youtubeId: {
        type: String,
        default: null
    },
    // Cloudinary public_id để xóa file khi cần
    cloudinaryId: {
        type: String,
        default: null
    },
    // Thumbnail từ YouTube
    thumbnail: {
        type: String,
        default: null
    },
    // Duration (seconds)
    duration: {
        type: Number,
        default: 0
    },
    // Per-user: null = system music (global), ObjectId = nhạc cá nhân
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    // Per-user favorites: mảng userId đã yêu thích
    favoritedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    playCount: {
        type: Number,
        default: 0
    },
    addedBy: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true
});

// Index để tìm kiếm nhanh
musicSchema.index({ name: 'text' });
musicSchema.index({ category: 1, type: 1 });
musicSchema.index({ userId: 1, type: 1 });

const Music = mongoose.model("Music", musicSchema);
export default Music;
