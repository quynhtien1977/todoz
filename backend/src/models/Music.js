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
    // Loại source: local file hoặc URL
    sourceType: {
        type: String,
        enum: ['local', 'url'],
        default: 'local'
    },
    // Đường dẫn file local (VD: /sounds/music/song.mp3)
    localPath: {
        type: String,
        required: true,
        default: null
    },
    // URL từ YouTube hoặc nguồn khác
    externalUrl: {
        type: String,
        default: null
    },
    // Để lưu thông tin embed YouTube
    youtubeId: {
        type: String,
        default: null
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    playCount: {
        type: Number,
        default: 0
    },
    // Ai thêm bài hát (có thể mở rộng cho multi-user sau)
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

const Music = mongoose.model("Music", musicSchema);
export default Music;
