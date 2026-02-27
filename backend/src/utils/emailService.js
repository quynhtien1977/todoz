/**
 * Email Service - Gửi OTP qua email
 * 
 * Sử dụng nodemailer với SMTP
 * Hỗ trợ: Gmail, Mailtrap, hoặc bất kỳ SMTP provider nào
 */

import nodemailer from "nodemailer";

/**
 * Tạo transporter dựa trên environment
 */
const createTransporter = () => {
    // Development: dùng Ethereal (fake SMTP) nếu không có config
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.warn("[EMAIL] SMTP chưa được cấu hình. Dùng console log thay thế.");
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465, // true cho port 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Gửi OTP email
 * @param {string} to - Email người nhận
 * @param {string} otp - Mã OTP 6 số
 * @param {string} name - Tên người dùng  
 * @returns {Promise<boolean>} true nếu gửi thành công
 */
export const sendOTPEmail = async (to, otp, name = "bạn") => {
    const transporter = createTransporter();

    const subject = `[TodoApp] Mã OTP đặt lại mật khẩu: ${otp}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
            .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
            .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); padding: 32px 24px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
            .body { padding: 32px 24px; }
            .otp-box { background: #f5f3ff; border: 2px solid #ddd6fe; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
            .otp-code { font-size: 36px; font-weight: 700; color: #7c3aed; letter-spacing: 8px; font-family: monospace; }
            .info { color: #64748b; font-size: 14px; line-height: 1.6; }
            .warning { background: #fef3c7; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-top: 16px; }
            .footer { padding: 16px 24px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Đặt lại mật khẩu</h1>
                <p>TodoApp - Quản lý công việc</p>
            </div>
            <div class="body">
                <p style="color: #334155; font-size: 16px;">Xin chào <strong>${name}</strong>,</p>
                <p class="info">Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản TodoApp. Vui lòng sử dụng mã OTP bên dưới:</p>
                
                <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                </div>
                
                <p class="info">Mã này sẽ hết hạn sau <strong>10 phút</strong>.</p>
                
                <div class="warning">
                    ⚠️ Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn.
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} TodoApp. Email này được gửi tự động.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `Xin chào ${name},\n\nMã OTP đặt lại mật khẩu của bạn là: ${otp}\n\nMã này sẽ hết hạn sau 10 phút.\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.`;

    // Nếu không có transporter (dev mode), log ra console
    if (!transporter) {
        console.log(`\n${"=".repeat(50)}`);
        console.log(`[EMAIL] OTP cho ${to}: ${otp}`);
        console.log(`${"=".repeat(50)}\n`);
        return true;
    }

    try {
        const info = await transporter.sendMail({
            from: `"TodoApp" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log(`[EMAIL] Sent to ${to}, messageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`[EMAIL] Error sending to ${to}:`, error.message);
        return false;
    }
};

export default sendOTPEmail;
