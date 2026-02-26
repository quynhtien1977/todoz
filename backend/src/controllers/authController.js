import User from "../models/User.js";
import Task from "../models/Task.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Hàm tạo JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
};

// Hàm gửi token response
const sendTokenResponse = (user, statusCode, res) => {
    const token = generateToken(user._id);
    
    const cookieOptions = {
        expires: new Date(Date.now() + (process.env.COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict"
    };
    
    user.password = undefined;
    
    res.status(statusCode)
        .cookie("token", token, cookieOptions)
        .json({
            success: true,
            token,
            user
        });
};

// ==================== VALIDATION HELPERS ====================
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validatePassword = (password) => {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return password.length >= 6 && hasLetter && hasNumber;
};

const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim();
};

// ==================== REGISTER ====================
export const register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;
        
        // Sanitize inputs
        const sanitizedName = sanitizeInput(name);
        const sanitizedEmail = sanitizeInput(email).toLowerCase();
        
        // Collect all validation errors
        const errors = {};
        
        // Validate name
        if (!sanitizedName) {
            errors.name = "Tên không được để trống";
        } else if (sanitizedName.length < 2) {
            errors.name = "Tên phải có ít nhất 2 ký tự";
        } else if (sanitizedName.length > 50) {
            errors.name = "Tên không được quá 50 ký tự";
        }
        
        // Validate email
        if (!sanitizedEmail) {
            errors.email = "Email không được để trống";
        } else if (!validateEmail(sanitizedEmail)) {
            errors.email = "Email không hợp lệ";
        }
        
        // Validate password
        if (!password) {
            errors.password = "Mật khẩu không được để trống";
        } else if (!validatePassword(password)) {
            errors.password = "Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ và số";
        }
        
        // Validate confirmPassword
        if (!confirmPassword) {
            errors.confirmPassword = "Vui lòng xác nhận mật khẩu";
        } else if (password !== confirmPassword) {
            errors.confirmPassword = "Mật khẩu xác nhận không khớp";
        }
        
        // Return errors if any
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                errors
            });
        }
        
        // Check duplicate email
        const existingUser = await User.findOne({ email: sanitizedEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email đã được sử dụng",
                errors: { email: "Email đã được sử dụng" }
            });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const user = await User.create({
            name: sanitizedName,
            email: sanitizedEmail,
            password: hashedPassword,
            authProvider: "local"
        });
        
        sendTokenResponse(user, 201, res);
        
    } catch (error) {
        console.error("Register error:", error);
        if (error.name === "ValidationError") {
            const errors = {};
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                errors
            });
        }
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "Email đã được sử dụng",
                errors: { email: "Email đã được sử dụng" }
            });
        }
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== LOGIN ====================
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập email và mật khẩu"
            });
        }
        
        const user = await User.findOne({ email }).select("+password");
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng"
            });
        }
        
        // Check nếu user đăng ký bằng OAuth
        if (user.authProvider !== "local") {
            return res.status(400).json({
                success: false,
                message: `Tài khoản này đăng ký bằng ${user.authProvider}. Vui lòng đăng nhập bằng ${user.authProvider}.`
            });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng"
            });
        }
        
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Tài khoản đã bị vô hiệu hóa"
            });
        }
        
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });
        
        sendTokenResponse(user, 200, res);
        
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== LOGOUT ====================
export const logout = async (req, res) => {
    res.cookie("token", "none", {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({ success: true, message: "Đăng xuất thành công" });
};

// ==================== GET PROFILE ====================
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== UPDATE PROFILE ====================
export const updateProfile = async (req, res) => {
    try {
        const { name, avatar } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, avatar },
            { new: true, runValidators: true }
        );
        
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu xác nhận không khớp"
            });
        }
        
        const user = await User.findById(req.user.id).select("+password");
        
        // OAuth users không có password
        if (user.authProvider !== "local") {
            return res.status(400).json({
                success: false,
                message: "Tài khoản OAuth không thể đổi mật khẩu"
            });
        }
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu hiện tại không đúng"
            });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        res.status(200).json({ success: true, message: "Đổi mật khẩu thành công" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== VERIFY TOKEN ====================
export const verifyToken = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(401).json({ success: false, message: "Token không hợp lệ" });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }
};

// ==================== MERGE GUEST TASKS ====================
export const mergeGuestTasks = async (req, res) => {
    try {
        const { guestTasks } = req.body;
        const userId = req.user._id;
        
        if (!guestTasks || !Array.isArray(guestTasks) || guestTasks.length === 0) {
            return res.status(200).json({
                success: true,
                message: "Không có tasks để merge",
                mergedCount: 0
            });
        }
        
        // Tạo tasks mới với userId
        const tasksToCreate = guestTasks.map(task => ({
            title: task.title,
            description: task.description || "",
            status: task.status || "pending",
            priority: task.priority || "medium",
            completedAt: task.completedAt || null,
            userId: userId
        }));
        
        const createdTasks = await Task.insertMany(tasksToCreate);
        
        res.status(200).json({
            success: true,
            message: `Đã merge ${createdTasks.length} tasks`,
            mergedCount: createdTasks.length
        });
    } catch (error) {
        console.error("Merge guest tasks error:", error);
        res.status(500).json({ success: false, message: "Lỗi khi merge tasks" });
    }
};

// ==================== OAUTH CALLBACK HANDLER ====================
export const oauthCallback = (req, res) => {
    const token = generateToken(req.user._id);
    
    // Set cookie trước khi redirect (sameSite: lax để OAuth redirect hoạt động)
    const cookieOptions = {
        expires: new Date(Date.now() + (process.env.COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    };
    res.cookie("token", token, cookieOptions);
    
    // Redirect về frontend - không đặt token trên URL (bảo mật hơn)
    res.redirect(`${process.env.FRONTEND_URL}/oauth/callback?success=true`);
};
