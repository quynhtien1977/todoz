/**
 * XSS Sanitization Middleware
 * 
 * Lọc HTML tags và potential XSS payloads từ req.body
 * Không dùng external package - lightweight custom implementation
 */

/**
 * Strip HTML tags từ string, giữ nguyên nội dung text
 * @param {string} str 
 * @returns {string}
 */
const stripHtmlTags = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove <script>...</script> tags và nội dung bên trong
    let clean = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onerror, onload, etc.)
    clean = clean.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
    clean = clean.replace(/\bon\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove all remaining HTML tags
    clean = clean.replace(/<\/?[^>]+(>|$)/g, '');
    
    // Remove javascript: protocol
    clean = clean.replace(/javascript\s*:/gi, '');
    
    // Remove data: protocol (potential XSS vector)
    clean = clean.replace(/data\s*:\s*text\/html/gi, '');
    
    return clean.trim();
};

/**
 * Recursively sanitize tất cả string values trong object
 * @param {*} obj 
 * @returns {*}
 */
const sanitizeValue = (obj) => {
    if (typeof obj === 'string') {
        return stripHtmlTags(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeValue(item));
    }
    if (obj !== null && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            // Không sanitize password fields
            if (key === 'password' || key === 'confirmPassword' || key === 'currentPassword' || key === 'newPassword') {
                sanitized[key] = value;
            } else {
                sanitized[key] = sanitizeValue(value);
            }
        }
        return sanitized;
    }
    return obj;
};

/**
 * Express middleware - sanitize req.body, req.query
 * Note: req.params không sanitize ở đây vì Express populate params SAU middleware
 * Dùng: app.use(sanitizeBody) hoặc router.use(sanitizeBody)
 */
export const sanitizeBody = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeValue(req.query);
    }
    next();
};

// Export cho testing
export { stripHtmlTags, sanitizeValue };

export default sanitizeBody;
