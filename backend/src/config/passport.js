import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import dotenv from "dotenv";

// Đảm bảo env vars đã được load trước khi đọc (ESM import chạy trước dotenv.config() trong server.js)
dotenv.config();

// ==================== GOOGLE STRATEGY ====================
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Tìm user đã tồn tại
            let user = await User.findOne({
                authProvider: "google",
                providerId: profile.id
            });
            
            if (!user) {
                // Kiểm tra email đã tồn tại chưa
                const existingUser = await User.findOne({ 
                    email: profile.emails[0].value 
                });
                
                if (existingUser) {
                    // Auto account linking — gộp OAuth vào account hiện có
                    existingUser.authProvider = "google";
                    existingUser.providerId = profile.id;
                    existingUser.avatar = profile.photos?.[0]?.value || existingUser.avatar;
                    await existingUser.save();
                    return done(null, existingUser);
                }
                
                // Tạo user mới
                user = await User.create({
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    avatar: profile.photos?.[0]?.value,
                    authProvider: "google",
                    providerId: profile.id
                });
            }
            
            // Cập nhật lastLogin
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });
            
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }));
}

// ==================== FACEBOOK STRATEGY ====================
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${BACKEND_URL}/api/auth/facebook/callback`,
        profileFields: ["id", "displayName", "photos", "email"]
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({
                authProvider: "facebook",
                providerId: profile.id
            });
            
            if (!user) {
                const email = profile.emails?.[0]?.value || `${profile.id}@facebook.com`;
                
                const existingUser = await User.findOne({ email });
                
                if (existingUser) {
                    // Auto account linking — gộp OAuth vào account hiện có
                    existingUser.authProvider = "facebook";
                    existingUser.providerId = profile.id;
                    existingUser.avatar = profile.photos?.[0]?.value || existingUser.avatar;
                    await existingUser.save();
                    return done(null, existingUser);
                }
                
                user = await User.create({
                    name: profile.displayName,
                    email: email,
                    avatar: profile.photos?.[0]?.value,
                    authProvider: "facebook",
                    providerId: profile.id
                });
            }
            
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });
            
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }));
}

// ==================== GITHUB STRATEGY ====================
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/auth/github/callback`,
        scope: ["user:email"]
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({
                authProvider: "github",
                providerId: profile.id.toString()
            });
            
            if (!user) {
                const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
                
                const existingUser = await User.findOne({ email });
                
                if (existingUser) {
                    // Auto account linking — gộp OAuth vào account hiện có
                    existingUser.authProvider = "github";
                    existingUser.providerId = profile.id.toString();
                    existingUser.avatar = profile.photos?.[0]?.value || existingUser.avatar;
                    await existingUser.save();
                    return done(null, existingUser);
                }
                
                user = await User.create({
                    name: profile.displayName || profile.username,
                    email: email,
                    avatar: profile.photos?.[0]?.value,
                    authProvider: "github",
                    providerId: profile.id.toString()
                });
            }
            
            user.lastLogin = new Date();
            await user.save({ validateBeforeSave: false });
            
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    }));
}

export default passport;
