import User from "../models/User.js";
import Task from "../models/Task.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logSecurityEvent } from "../utils/securityLogger.js";
import { generateOTP, hashOTP, verifyOTP as verifyOTPHash, OTP_EXPIRY_MINUTES, MAX_OTP_ATTEMPTS } from "../utils/otpGenerator.js";
import sendOTPEmail from "../utils/emailService.js";

// ==================== CONSTANTS ====================
const MAX_LOGIN_ATTEMPTS = 10; // Số lần đăng nhập sai tối đa trước khi khóa tài khoản
const LOCK_TIME = 5 * 60 * 1000; // 5 phút

// Hàm tạo JWT token
const generateToken = (userId) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined in environment variables");
    }
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
        
        logSecurityEvent('REGISTER', { email: sanitizedEmail, userId: user._id }, req);
        
    } catch (error) {
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
        
        const user = await User.findOne({ email }).select("+password +loginAttempts +lockUntil");
        
        if (!user) {
            logSecurityEvent('LOGIN_FAILED', { email, reason: 'user_not_found' }, req);
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng"
            });
        }
        
        // Check account lockout
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMs = user.lockUntil - Date.now();
            const remainingMin = Math.ceil(remainingMs / 60000);
            logSecurityEvent('LOGIN_FAILED', { email, reason: 'account_locked' }, req);
            return res.status(423).json({
                success: false,
                message: `Tài khoản đã bị khóa tạm thời. Vui lòng thử lại sau ${remainingMin} phút.`,
                lockUntil: user.lockUntil,
                remainingMinutes: remainingMin
            });
        }
        
        // Reset lock nếu đã hết hạn
        if (user.lockUntil && user.lockUntil <= Date.now()) {
            user.loginAttempts = 0;
            user.lockUntil = null;
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
            // Increment login attempts
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            
            if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
                user.lockUntil = new Date(Date.now() + LOCK_TIME);
                await user.save({ validateBeforeSave: false });
                
                const remainingMin = Math.ceil(LOCK_TIME / 60000);
                logSecurityEvent('ACCOUNT_LOCKED', { 
                    email, 
                    userId: user._id,
                    attempts: user.loginAttempts 
                }, req);
                
                return res.status(423).json({
                    success: false,
                    message: `Quá nhiều lần đăng nhập sai. Tài khoản bị khóa ${remainingMin} phút.`,
                    lockUntil: user.lockUntil,
                    remainingMinutes: remainingMin
                });
            }
            
            await user.save({ validateBeforeSave: false });
            
            const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
            logSecurityEvent('LOGIN_FAILED', { 
                email, 
                reason: 'wrong_password', 
                attemptsLeft 
            }, req);
            
            return res.status(401).json({
                success: false,
                message: "Email hoặc mật khẩu không đúng",
                attemptsLeft
            });
        }
        
        if (!user.isActive) {
            logSecurityEvent('LOGIN_FAILED', { email, reason: 'inactive' }, req);
            return res.status(401).json({
                success: false,
                message: "Tài khoản đã bị vô hiệu hóa"
            });
        }
        
        // Login thành công - reset lockout
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });
        
        logSecurityEvent('LOGIN_SUCCESS', { email, userId: user._id }, req);
        sendTokenResponse(user, 200, res);
        
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== LOGOUT ====================
export const logout = async (req, res) => {
    logSecurityEvent('LOGOUT', {}, req);
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
        const taskStats = await Task.aggregate([
            { $match: { userId: user._id } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } }
                }
            }
        ]);

        const stats = taskStats[0] || { total: 0, completed: 0, pending: 0 };
        const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

        res.status(200).json({
            success: true,
            user,
            stats: {
                totalTasks: stats.total,
                completedTasks: stats.completed,
                pendingTasks: stats.pending,
                completionRate
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== UPDATE PROFILE ====================
export const updateProfile = async (req, res) => {
    try {
        const { name, avatar, bio, phone, location } = req.body;

        // Build update object — only include fields that were sent
        const updateFields = {};
        if (name !== undefined) updateFields.name = sanitizeInput(name);
        if (avatar !== undefined) updateFields.avatar = avatar;
        if (bio !== undefined) updateFields.bio = sanitizeInput(bio);
        if (phone !== undefined) updateFields.phone = sanitizeInput(phone);
        if (location !== undefined) updateFields.location = sanitizeInput(location);

        // Validate name if provided
        if (updateFields.name !== undefined) {
            if (updateFields.name.length < 2) {
                return res.status(400).json({ success: false, message: "Tên phải có ít nhất 2 ký tự" });
            }
            if (updateFields.name.length > 50) {
                return res.status(400).json({ success: false, message: "Tên không được quá 50 ký tự" });
            }
        }

        // Validate bio length
        if (updateFields.bio !== undefined && updateFields.bio.length > 200) {
            return res.status(400).json({ success: false, message: "Bio không được quá 200 ký tự" });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateFields,
            { new: true, runValidators: true }
        );
        
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== UPDATE PREFERENCES ====================
export const updatePreferences = async (req, res) => {
    try {
        const { theme, language, defaultPriority, notifications } = req.body;

        const updateFields = {};
        if (theme !== undefined) updateFields["preferences.theme"] = theme;
        if (language !== undefined) updateFields["preferences.language"] = language;
        if (defaultPriority !== undefined) updateFields["preferences.defaultPriority"] = defaultPriority;
        if (notifications !== undefined) {
            if (notifications.email !== undefined) updateFields["preferences.notifications.email"] = notifications.email;
            if (notifications.push !== undefined) updateFields["preferences.notifications.push"] = notifications.push;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Lỗi hệ thống" });
    }
};

// ==================== DELETE ACCOUNT ====================
export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const user = await User.findById(req.user.id).select("+password");

        // For local auth users, require password confirmation
        if (user.authProvider === "local") {
            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: "Vui lòng nhập mật khẩu để xác nhận xóa tài khoản"
                });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu không đúng"
                });
            }
        }

        // Delete all user tasks
        await Task.deleteMany({ userId: user._id });

        // Delete user
        await User.findByIdAndDelete(user._id);

        logSecurityEvent('ACCOUNT_DELETED', { userId: user._id, email: user.email }, req);

        // Clear cookie
        res.cookie("token", "none", {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        });

        res.status(200).json({
            success: true,
            message: "Tài khoản đã được xóa thành công"
        });
    } catch (error) {
        console.error("Delete account error:", error);
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
        
        // Validate new password strength
        if (!newPassword || !validatePassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm chữ và số"
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
        
        // Kiểm tra mật khẩu mới khác mật khẩu cũ
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu mới phải khác mật khẩu hiện tại"
            });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        logSecurityEvent('PASSWORD_CHANGED', { userId: user._id, email: user.email }, req);
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
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/oauth/callback?success=true`);
};

// ==================== FORGOT PASSWORD ====================
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập email hợp lệ"
            });
        }

        const sanitizedEmail = sanitizeInput(email).toLowerCase();

        // Tìm user local (không hỗ trợ OAuth-only accounts)
        const user = await User.findOne({
            email: sanitizedEmail,
            authProvider: "local"
        });

        // Luôn trả về success để tránh user enumeration
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "Nếu email tồn tại, mã OTP đã được gửi"
            });
        }

        // Kiểm tra xem user có bị khóa không
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.status(429).json({
                success: false,
                message: "Tài khoản đang bị khóa. Vui lòng thử lại sau"
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const hashedOTP = hashOTP(otp);

        // Lưu OTP vào user
        user.resetPasswordOTP = hashedOTP;
        user.resetPasswordOTPExpires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        user.resetPasswordAttempts = 0;
        await user.save();

        // Gửi email
        await sendOTPEmail(sanitizedEmail, otp, user.name);

        logSecurityEvent("PASSWORD_RESET_REQUESTED", {
            userId: user._id,
            email: sanitizedEmail,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: "Nếu email tồn tại, mã OTP đã được gửi"
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi xử lý yêu cầu"
        });
    }
};

// ==================== VERIFY OTP ====================
export const verifyOTPController = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập email và mã OTP"
            });
        }

        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: "Mã OTP phải gồm 6 chữ số"
            });
        }

        const sanitizedEmail = sanitizeInput(email).toLowerCase();

        const user = await User.findOne({
            email: sanitizedEmail,
            authProvider: "local"
        }).select("+resetPasswordOTP +resetPasswordOTPExpires");

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Mã OTP không hợp lệ hoặc đã hết hạn"
            });
        }

        // Kiểm tra OTP đã được yêu cầu chưa
        if (!user.resetPasswordOTP || !user.resetPasswordOTPExpires) {
            return res.status(400).json({
                success: false,
                message: "Mã OTP không hợp lệ hoặc đã hết hạn"
            });
        }

        // Kiểm tra hết hạn
        if (user.resetPasswordOTPExpires < Date.now()) {
            user.resetPasswordOTP = undefined;
            user.resetPasswordOTPExpires = undefined;
            user.resetPasswordAttempts = 0;
            await user.save();

            return res.status(400).json({
                success: false,
                message: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới"
            });
        }

        // Kiểm tra số lần thử
        if (user.resetPasswordAttempts >= MAX_OTP_ATTEMPTS) {
            user.resetPasswordOTP = undefined;
            user.resetPasswordOTPExpires = undefined;
            user.resetPasswordAttempts = 0;
            await user.save();

            logSecurityEvent("OTP_MAX_ATTEMPTS", {
                userId: user._id,
                email: sanitizedEmail,
                ip: req.ip
            });

            return res.status(429).json({
                success: false,
                message: "Đã vượt quá số lần thử. Vui lòng yêu cầu mã OTP mới"
            });
        }

        // Verify OTP hash
        if (!verifyOTPHash(otp, user.resetPasswordOTP)) {
            user.resetPasswordAttempts += 1;
            await user.save();

            const remainingAttempts = MAX_OTP_ATTEMPTS - user.resetPasswordAttempts;

            return res.status(400).json({
                success: false,
                message: `Mã OTP không đúng. Còn ${remainingAttempts} lần thử`
            });
        }

        // OTP hợp lệ → tạo reset token (5 phút)
        const resetToken = jwt.sign(
            { id: user._id, purpose: "reset-password" },
            process.env.JWT_SECRET,
            { expiresIn: "5m" }
        );

        // Xóa OTP sau khi verify thành công
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;
        user.resetPasswordAttempts = 0;
        await user.save();

        logSecurityEvent("OTP_VERIFIED", {
            userId: user._id,
            email: sanitizedEmail,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: "Xác thực OTP thành công",
            resetToken
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi xác thực OTP"
        });
    }
};

// ==================== RESET PASSWORD ====================
export const resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng nhập đầy đủ thông tin"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu xác nhận không khớp"
            });
        }

        // Validate password strength
        if (!validatePassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ cái và số"
            });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch (jwtError) {
            return res.status(400).json({
                success: false,
                message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại"
            });
        }

        if (decoded.purpose !== "reset-password") {
            return res.status(400).json({
                success: false,
                message: "Token không hợp lệ"
            });
        }

        const user = await User.findById(decoded.id).select("+password");

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Người dùng không tồn tại"
            });
        }

        // Kiểm tra mật khẩu mới không trùng mật khẩu cũ
        if (user.password) {
            const isSamePassword = await bcrypt.compare(newPassword, user.password);
            if (isSamePassword) {
                return res.status(400).json({
                    success: false,
                    message: "Mật khẩu mới không được trùng với mật khẩu cũ"
                });
            }
        }

        // Hash và lưu mật khẩu mới
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(newPassword, salt);

        // Reset lockout nếu có
        user.loginAttempts = 0;
        user.lockUntil = undefined;

        // Xóa OTP fields (phòng trường hợp)
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;
        user.resetPasswordAttempts = 0;

        await user.save();

        logSecurityEvent("PASSWORD_RESET_SUCCESS", {
            userId: user._id,
            email: user.email,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại"
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi đặt lại mật khẩu"
        });
    }
};
