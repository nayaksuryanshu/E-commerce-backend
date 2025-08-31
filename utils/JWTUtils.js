const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTUtils {
  static generateTokens(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m'
    });
    
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
    });
    
    return { accessToken, refreshToken };
  }
  
  static verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  }
  
  static verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  }
  
  static generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = JWTUtils;