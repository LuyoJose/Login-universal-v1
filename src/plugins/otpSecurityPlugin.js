let otpAttempts = {};

module.exports = function otpSecurityPlugin(req, res, next) {
    if (req.url.includes('/auth/send-otp')) {
        const ip = req.ip;
        otpAttempts[ip] = (otpAttempts[ip] || 0) + 1;

        if (otpAttempts[ip] > 5) {
            return res.status(429).json({ error: 'Demasiados intentos de OTP, inténtalo más tarde' });
        }
    }
    next();
};
