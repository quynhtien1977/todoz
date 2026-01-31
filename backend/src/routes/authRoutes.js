import express from "express";
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
    oauthCallback
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// ==================== LOCAL AUTH ====================
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

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

router.get("/google/callback",
    passport.authenticate("google", { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`
    }),
    oauthCallback
);

// ==================== FACEBOOK OAUTH ====================
router.get("/facebook", passport.authenticate("facebook", {
    scope: ["email"]
}));

router.get("/facebook/callback",
    passport.authenticate("facebook", { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=facebook_auth_failed`
    }),
    oauthCallback
);

// ==================== GITHUB OAUTH ====================
router.get("/github", passport.authenticate("github", {
    scope: ["user:email"]
}));

router.get("/github/callback",
    passport.authenticate("github", { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=github_auth_failed`
    }),
    oauthCallback
);

export default router;
