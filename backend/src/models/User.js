import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Vui lòng nhập tên"],
        trim: true,
        minlength: [2, "Tên phải có ít nhất 2 ký tự"],
        maxlength: [50, "Tên không được quá 50 ký tự"]
    },
    email: {
        type: String,
        required: [true, "Vui lòng nhập email"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"]
    },
    password: {
        type: String,
        minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
        select: false // Không trả về password khi query
        // Không required vì OAuth không cần password
    },
    avatar: {
        type: String,
        default: "/default_avatar.jpg"
    },
    
    // OAuth providers
    authProvider: {
        type: String,
        enum: ["local", "google", "facebook", "github"],
        default: "local"
    },
    providerId: {
        type: String,
        default: null // ID từ Google/Facebook/GitHub
    },
    
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Index cho OAuth lookup
userSchema.index({ authProvider: 1, providerId: 1 });

const User = mongoose.model("User", userSchema);
export default User;
