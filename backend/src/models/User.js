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
    
    // Account tier
    role: {
        type: String,
        enum: ["free", "pro", "admin"],
        default: "free"
    },
    
    // Profile fields
    bio: {
        type: String,
        maxlength: [200, "Bio không được quá 200 ký tự"],
        default: ""
    },
    phone: {
        type: String,
        default: ""
    },
    location: {
        type: String,
        maxlength: [100, "Địa chỉ không được quá 100 ký tự"],
        default: ""
    },
    
    // User preferences
    preferences: {
        theme: {
            type: String,
            enum: ["light", "dark", "system"],
            default: "system"
        },
        language: {
            type: String,
            enum: ["vi", "en"],
            default: "vi"
        },
        defaultPriority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium"
        },
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        }
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
    },
    
    // Account lockout (chống brute force)
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    },
    
    // Password reset OTP
    resetPasswordOTP: {
        type: String,
        select: false
    },
    resetPasswordOTPExpires: {
        type: Date,
        select: false
    },
    resetPasswordAttempts: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
userSchema.index({ authProvider: 1, providerId: 1 });
userSchema.index({ role: 1 });

const User = mongoose.model("User", userSchema);
export default User;
