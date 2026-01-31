import express from "express";
import taskRoute from "./routes/taskRouters.js";
import chatRoute from "./routes/chatRoutes.js";
import musicRoute from "./routes/musicRoutes.js";
import authRoute from "./routes/authRoutes.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";

dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

if (process.env.NODE_ENV === "development") {
  app.use(cors({ 
    origin: "http://localhost:5173",
    credentials: true // Cho phép gửi cookies
  }));
}

// Routes
app.use("/api/auth", authRoute);
app.use("/api/tasks", taskRoute);
app.use("/api/chat", chatRoute);
app.use("/api/music", musicRoute);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Sever bắt đầu chạy trên cổng ${PORT}`);
  });
});
