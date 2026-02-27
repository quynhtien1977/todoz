import express from "express";
import rateLimit from "express-rate-limit";
import passport from "passport";
import {
    register,
    login,
    logout,
    getProfile,
    updateProfile,
    changePassword,
    verifyToken,
    mergeGuestTasks,
    oauthCallback,
    forgotPassword,
    verifyOTPController,
    resetPassword
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Helper: lấy FRONTEND_URL lúc runtime (tránh undefined do ESM import trước dotenv)
const getFrontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";

// Rate limiter riêng cho forgot-password (3 requests / 15 phút)
const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: {
        success: false,
        message: "Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau 15 phút"
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ==================== LOCAL AUTH ====================
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// ==================== FORGOT / RESET PASSWORD ====================
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/verify-otp", verifyOTPController);
router.post("/reset-password", resetPassword);

// ==================== PROTECTED ROUTES ====================
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.get("/verify", protect, verifyToken);
router.post("/merge-tasks", protect, mergeGuestTasks);

// ==================== GOOGLE OAUTH ====================
router.get("/google", passport.authenticate("google", {
    scope: ["profile", "email"]
}));

router.get("/google/callback", (req, res, next) => {
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${getFrontendUrl()}/login?error=google_auth_failed`
    })(req, res, next);
}, oauthCallback);

// ==================== FACEBOOK OAUTH ====================
router.get("/facebook", passport.authenticate("facebook", {
    scope: ["email"]
}));

router.get("/facebook/callback", (req, res, next) => {
    passport.authenticate("facebook", {
        session: false,
        failureRedirect: `${getFrontendUrl()}/login?error=facebook_auth_failed`
    })(req, res, next);
}, oauthCallback);

// ==================== GITHUB OAUTH ====================
router.get("/github", passport.authenticate("github", {
    scope: ["user:email"]
}));

router.get("/github/callback", (req, res, next) => {
    passport.authenticate("github", {
        session: false,
        failureRedirect: `${getFrontendUrl()}/login?error=github_auth_failed`
    })(req, res, next);
}, oauthCallback);

export default router;
