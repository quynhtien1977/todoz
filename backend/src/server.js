import express from "express";
import taskRoute from "./routes/taskRouters.js";
import chatRoute from "./routes/chatRoutes.js";
import musicRoute from "./routes/musicRoutes.js";
import authRoute from "./routes/authRoutes.js";
import uploadRoute from "./routes/uploadRoutes.js";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import passport from "./config/passport.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { sanitizeRequest } from "./middleware/xssSanitizer.js";

dotenv.config();

const PORT = process.env.PORT;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==================== SECURITY MIDDLEWARE ====================

// 0. Trust proxy - Cần thiết khi deploy sau reverse proxy (Render, Railway, Nginx...)
// Để rate limiter đọc đúng IP thật của client thay vì IP của proxy
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// 1. Helmet - Set security HTTP headers
// Cấu hình để không block React app trong production
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://res.cloudinary.com"],
      connectSrc: ["'self'"],
    }
  } : false,
  crossOriginEmbedderPolicy: false,
}));

// 2. Rate limiting - Chống brute force & spam requests (Postman, bot...)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 200, // Tối đa 200 requests / 15 phút / IP
  message: {
    success: false,
    message: "Quá nhiều request từ IP này, vui lòng thử lại sau 15 phút"
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Rate limit nghiêm ngặt cho auth endpoints (chống brute force login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 15, // Tối đa 15 attempts / 15 phút / IP
  message: {
    success: false,
    message: "Quá nhiều lần thử đăng nhập/đăng ký, vui lòng thử lại sau 15 phút"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit cho AI chat (tránh lạm dụng API key)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 10, // Tối đa 10 messages / phút / IP
  message: {
    success: false,
    message: "Quá nhiều tin nhắn, vui lòng chờ 1 phút"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. Body parser với giới hạn kích thước (chống payload quá lớn)
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// 4. Cookie parser
app.use(cookieParser());

// 5. Mongo sanitize - Chống NoSQL injection (vd: {"email": {"$gt": ""}})
app.use(mongoSanitize());

// 6. HPP - Chống HTTP Parameter Pollution
app.use(hpp());

// 7. XSS Sanitizer - Lọc HTML/script tags từ user input
app.use(sanitizeRequest);

// 8. Passport
app.use(passport.initialize());

// 9. CORS - Hỗ trợ cả development và production (deploy riêng frontend/backend)
const corsOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
app.use(cors({ 
  origin: corsOrigin,
  credentials: true, // Cho phép gửi cookies
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ==================== ROUTES ====================

// Apply auth rate limiter only to login/register (NOT to verify, profile, OAuth callbacks)
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth", authRoute);
app.use("/api/upload", uploadRoute);
app.use("/api/tasks", taskRoute);
app.use("/api/chat", chatLimiter, chatRoute);
app.use("/api/music", musicRoute);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
  });
}

// ==================== GLOBAL ERROR HANDLER ====================
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  });
});

// ==================== PROCESS ERROR HANDLERS ====================
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

// ==================== STARTUP VALIDATION ====================
const validateEnv = () => {
  const required = ["MONGODB_CONNECT_STRING", "JWT_SECRET"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    console.warn("  FRONTEND_URL not set - OAuth redirects may fail");
  }
};

validateEnv();

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT} [${process.env.NODE_ENV}]`);
  });
});
