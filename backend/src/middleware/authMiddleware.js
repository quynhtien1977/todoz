import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization?.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập để truy cập"
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User không tồn tại"
            });
        }
        
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản đã bị vô hiệu hóa"
            });
        }
        
        req.user = user;
        next();
        
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Token không hợp lệ hoặc đã hết hạn"
        });
    }
};

// Middleware cho routes không bắt buộc đăng nhập (Guest Mode)
export const optionalAuth = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization?.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id);
        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                // Token invalid/expired, continue as guest
            } else {
                // Unexpected error (DB error, etc.) — log nhưng vẫn tiếp tục
                console.error('[optionalAuth] Unexpected error:', error.message);
            }
        }
    }
    
    next();
};
// Middleware phân quyền theo role (free, pro, admin)
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Vui lòng đăng nhập để truy cập"
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Bạn không có quyền truy cập tính năng này"
            });
        }
        
        next();
    };
};

// Middleware kiểm tra tính năng PRO
export const requirePro = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Vui lòng đăng nhập để truy cập"
        });
    }
    
    if (req.user.role !== "pro" && req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Tính năng này chỉ dành cho tài khoản Pro. Vui lòng nâng cấp"
        });
    }
    
    next();
};