import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// uploads/avatars nằm tại backend/uploads/avatars (cùng cấp với src/)
const uploadsDir = path.join(__dirname, "../../uploads/avatars");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config — lưu tạm vào memory để sharp xử lý trước khi ghi file
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // sharp hỗ trợ rất nhiều format, accept rộng rãi
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Chỉ chấp nhận file ảnh"), false);
    }
};

const upload = multer({
    storage: memoryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB raw input (will be resized)
});

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

        // Delete old avatar file if it exists on disk
        const currentUser = await User.findById(req.user.id);
        if (currentUser?.avatar && currentUser.avatar !== "/default_avatar.jpg") {
            // avatar stored as "/uploads/avatars/filename.webp"
            const oldPath = path.join(__dirname, "../../", currentUser.avatar);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
        }

        // Process image with sharp:
        // - Resize to 400x400 (covers most avatar use cases — displayed at 96px but retina-ready)
        // - Crop to square (cover fit, centered)
        // - Convert to WebP for smaller file size
        // - Quality 85 for good balance of quality vs size
        const filename = `avatar_${req.user.id}_${Date.now()}.webp`;
        const outputPath = path.join(uploadsDir, filename);

        await sharp(req.file.buffer)
            .resize(400, 400, {
                fit: "cover",       // Crop to fill the square
                position: "centre"  // Center the crop
            })
            .webp({ quality: 85 })
            .toFile(outputPath);

        const avatarUrl = `/uploads/avatars/${filename}`;

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
        res.status(500).json({ success: false, message: "Lỗi xử lý ảnh" });
    }
});

export default router;
