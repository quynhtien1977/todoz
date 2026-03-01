import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// Multer memory storage — giữ buffer để upload lên Cloudinary
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file ảnh"), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

/**
 * Upload buffer lên Cloudinary, trả về URL
 * - folder: todoz-avatars
 * - public_id: avatar_<userId> (overwrite mỗi lần upload → không rác)
 * - transformation: resize 400x400, crop fill, quality auto, format auto (webp/avif)
 */
const uploadToCloudinary = (buffer, userId) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "todoz-avatars",
                public_id: `avatar_${userId}`,
                overwrite: true,
                transformation: [
                    { width: 400, height: 400, crop: "fill", gravity: "face" }
                ],
                format: "webp",
                quality: "auto",
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
};

// POST /api/upload/avatar
router.post("/avatar", protect, (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "File quá lớn. Tối đa 5MB"
                });
            }
            return res.status(400).json({ success: false, message: err.message });
        }
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn file ảnh"
            });
        }

        // Upload lên Cloudinary (tự overwrite avatar cũ cùng public_id)
        const result = await uploadToCloudinary(req.file.buffer, req.user.id);

        // Lưu URL Cloudinary vào DB (secure_url = https://res.cloudinary.com/...)
        const avatarUrl = result.secure_url;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: avatarUrl },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Cập nhật avatar thành công",
            avatar: avatarUrl,
            user
        });
    } catch (error) {
        console.error("Upload avatar error:", error);
        res.status(500).json({ success: false, message: "Lỗi upload ảnh" });
    }
});

// DELETE /api/upload/avatar — Xóa avatar, reset về default
router.delete("/avatar", protect, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);

        // Xóa avatar trên Cloudinary nếu có (không xóa nếu đang dùng system avatar hoặc default)
        if (currentUser?.avatar && currentUser.avatar.includes("res.cloudinary.com")) {
            try {
                await cloudinary.uploader.destroy(`todoz-avatars/avatar_${req.user.id}`, {
                    resource_type: "image"
                });
            } catch (e) {
                console.error("Cloudinary delete error:", e);
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: "/default_avatar.jpg" },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Đã xóa avatar",
            user
        });
    } catch (error) {
        console.error("Delete avatar error:", error);
        res.status(500).json({ success: false, message: "Lỗi xóa avatar" });
    }
});

// PUT /api/upload/avatar/system — Chọn avatar hệ thống
router.put("/avatar/system", protect, async (req, res) => {
    try {
        const { avatarId } = req.body;

        // Danh sách avatar hệ thống hợp lệ
        const systemAvatars = [
            "cat", "dog", "fox", "panda", "koala",
            "owl", "penguin", "rabbit", "bear", "unicorn",
            "astronaut", "robot"
        ];

        if (!avatarId || !systemAvatars.includes(avatarId)) {
            return res.status(400).json({
                success: false,
                message: "Avatar không hợp lệ"
            });
        }

        // Xóa avatar cũ trên Cloudinary nếu có
        const currentUser = await User.findById(req.user.id);
        if (currentUser?.avatar && currentUser.avatar.includes("res.cloudinary.com")) {
            try {
                await cloudinary.uploader.destroy(`todoz-avatars/avatar_${req.user.id}`, {
                    resource_type: "image"
                });
            } catch (e) {
                console.error("Cloudinary delete error:", e);
            }
        }

        const avatarPath = `/avatars/system/${avatarId}.svg`;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: avatarPath },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Cập nhật avatar thành công",
            avatar: avatarPath,
            user
        });
    } catch (error) {
        console.error("System avatar error:", error);
        res.status(500).json({ success: false, message: "Lỗi cập nhật avatar" });
    }
});

export default router;
