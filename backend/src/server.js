import express from "express";
import taskRoute from "./routes/taskRouters.js";
import chatRoute from "./routes/chatRoutes.js";
import musicRoute from "./routes/musicRoutes.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

const app = express();

// Middleware

app.use(express.json());

if (process.env.NODE_ENV === "development") {
  app.use(cors({ origin: "http://localhost:5173" }));
}
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
