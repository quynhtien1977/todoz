/**
 * Security Logger - Ghi log các sự kiện bảo mật
 * 
 * Events: LOGIN_SUCCESS, LOGIN_FAILED, ACCOUNT_LOCKED, ACCOUNT_UNLOCKED,
 *         REGISTER, PASSWORD_CHANGED, LOGOUT, XSS_BLOCKED
 */

const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
};

const EVENT_LEVELS = {
    LOGIN_SUCCESS: LOG_LEVELS.INFO,
    LOGIN_FAILED: LOG_LEVELS.WARN,
    ACCOUNT_LOCKED: LOG_LEVELS.WARN,
    ACCOUNT_UNLOCKED: LOG_LEVELS.INFO,
    REGISTER: LOG_LEVELS.INFO,
    PASSWORD_CHANGED: LOG_LEVELS.INFO,
    LOGOUT: LOG_LEVELS.INFO,
    XSS_BLOCKED: LOG_LEVELS.WARN,
    INVALID_TOKEN: LOG_LEVELS.WARN,
    INACTIVE_USER: LOG_LEVELS.WARN,
};

/**
 * Log security event
 * @param {string} event - Tên sự kiện
 * @param {object} details - Chi tiết
 * @param {object} req - Express request object (optional)
 */
export const logSecurityEvent = (event, details = {}, req = null) => {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        level: EVENT_LEVELS[event] || LOG_LEVELS.INFO,
        ...details,
    };

    // Lấy thông tin từ request nếu có
    if (req) {
        logEntry.ip = req.ip || req.connection?.remoteAddress;
        logEntry.userAgent = req.get('user-agent');
        logEntry.method = req.method;
        logEntry.path = req.originalUrl;
    }

    // Structured JSON log
    const level = logEntry.level;
    if (level === LOG_LEVELS.ERROR) {
        console.error(`[SECURITY] ${JSON.stringify(logEntry)}`);
    } else if (level === LOG_LEVELS.WARN) {
        console.warn(`[SECURITY] ${JSON.stringify(logEntry)}`);
    } else {
        console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
    }

    return logEntry;
};

export default { logSecurityEvent };
