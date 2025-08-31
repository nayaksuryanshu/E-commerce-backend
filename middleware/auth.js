const jwt=require('jsonwebtoken');
const JWTUtils = require('../utils/JWTUtils');
const User = require('../models/User');

const protect = async (req, res, next) => {
    try {
        let token
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        else if (req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) { return res.status(401).json({ message: 'Not authorized, no token' }); }

        try {
            const decoded = JWTUtils.verifyAccessToken(token);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // Fix: Change isActive to isAccountActive
            if(!user.isAccountActive) {
                return res.status(403).json({ message: 'User is not active' });
            }

            // // Also fix this method call if it exists
            // if(user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
            //     return res.status(401).json({ message: 'User password has changed, please login again' });
            // }

            req.user = user;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired, please login again' });
            }
            return res.status(401).json({ message: 'Not authorized, token invalid' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
}

    const authorize= (...roles) => {
        return (req, res, next) => {
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'Forbidden, you do not have permission to access this resource' });
            }
            next();
        }
    }

const optionalAuth = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
        token = req.cookies.token;
    }

    if (token) {
        try {
            const decoded = JWTUtils.verifyAccessToken(token);
            const user = await User.findById(decoded.id).select('-password');
            
            // Fix: Change isActive to isAccountActive and remove changedPasswordAfter
            if (user && user.isAccountActive) {
                req.user = user;
            }
        } catch (error) {
            // Silent fail for optional auth
        }
    }
    next();
};
    
module.exports = {
    protect,
    authorize,
    optionalAuth
};