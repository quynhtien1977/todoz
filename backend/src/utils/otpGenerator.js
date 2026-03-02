/**
 * OTP Generator Utility
 * 
 * - Generate 6-digit numeric OTP
 * - Hash OTP dùng crypto (nhanh hơn bcrypt)
 * - Verify OTP
 */

import crypto from "crypto";

/**
 * Generate 6-digit OTP
 * @returns {string} 6-digit OTP
 */
export const generateOTP = () => {
    // Crypto random cho security (không dùng Math.random)
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
};

/**
 * Hash OTP dùng SHA-256 (nhanh hơn bcrypt cho short-lived tokens)
 * @param {string} otp - Plain OTP
 * @returns {string} Hashed OTP
 */
export const hashOTP = (otp) => {
    return crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");
};

/**
 * Verify OTP bằng cách compare hash
 * @param {string} plainOTP - OTP user nhập
 * @param {string} hashedOTP - OTP đã hash trong DB
 * @returns {boolean}
 */
export const verifyOTP = (plainOTP, hashedOTP) => {
    const hashed = hashOTP(plainOTP);
    return hashed === hashedOTP;
};

// OTP config
export const OTP_EXPIRY_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 3;
