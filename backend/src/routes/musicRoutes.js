import express from "express";
import {
    getAllMusic,
    getMusicById,
    addMusic,
    updateMusic,
    deleteMusic,
    toggleFavorite,
    incrementPlayCount,
    seedMusic,
    previewYouTube,
    addFromYouTube,
} from "../controllers/musicController.js";
import { optionalAuth, protect, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/music - Lấy tất cả nhạc (system + nhạc cá nhân nếu đã login)
router.get("/", optionalAuth, getAllMusic);

// POST /api/music/seed - Seed initial music data (admin only)
router.post("/seed", protect, requireRole("admin"), seedMusic);

// POST /api/music/youtube/preview - Preview YouTube video info
router.post("/youtube/preview", protect, previewYouTube);

// POST /api/music/youtube - Thêm nhạc từ YouTube (extract + upload Cloudinary)
router.post("/youtube", protect, addFromYouTube);

// GET /api/music/:id - Lấy một bài nhạc theo ID
router.get("/:id", optionalAuth, getMusicById);

// POST /api/music - Thêm nhạc mới (admin)
router.post("/", protect, addMusic);

// PUT /api/music/:id - Cập nhật nhạc
router.put("/:id", protect, updateMusic);

// DELETE /api/music/:id - Xóa nhạc (chỉ nhạc cá nhân hoặc admin)
router.delete("/:id", protect, deleteMusic);

// PATCH /api/music/:id/favorite - Toggle favorite (per-user)
router.patch("/:id/favorite", protect, toggleFavorite);

// PATCH /api/music/:id/play - Increment play count
router.patch("/:id/play", optionalAuth, incrementPlayCount);

export default router;
