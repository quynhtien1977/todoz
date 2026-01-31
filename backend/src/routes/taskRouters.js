import express from "express";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../controllers/tasksControllers.js";
import { protect, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET tasks - optionalAuth cho phép guest xem (trả về empty)
router.get("/", optionalAuth, getAllTasks);

// Các route khác yêu cầu đăng nhập
router.post("/", optionalAuth, createTask);

router.put("/:id", optionalAuth, updateTask);

router.delete("/:id", optionalAuth, deleteTask);

export default router;
