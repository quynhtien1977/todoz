import express from "express";
import {
    getAllMusic,
    getMusicById,
    addMusic,
    updateMusic,
    deleteMusic,
    toggleFavorite,
    incrementPlayCount,
    seedMusic
} from "../controllers/musicController.js";

const router = express.Router();

// GET /api/music - Lấy tất cả nhạc (có thể filter theo type, category)
router.get("/", getAllMusic);

// POST /api/music/seed - Seed initial music data
router.post("/seed", seedMusic);

// GET /api/music/:id - Lấy một bài nhạc theo ID
router.get("/:id", getMusicById);

// POST /api/music - Thêm nhạc mới
router.post("/", addMusic);

// PUT /api/music/:id - Cập nhật nhạc
router.put("/:id", updateMusic);

// DELETE /api/music/:id - Xóa nhạc
router.delete("/:id", deleteMusic);

// PATCH /api/music/:id/favorite - Toggle favorite
router.patch("/:id/favorite", toggleFavorite);

// PATCH /api/music/:id/play - Increment play count
router.patch("/:id/play", incrementPlayCount);

export default router;
