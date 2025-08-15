const jwt = require('jsonwebtoken');
const config = require('../config/config');

class JWTUtils {
  /**
   * 生成Access Token - 包含完整用户信息
   * @param {Object} user - 用户信息
   * @returns {string} access token
   */
  static generateAccessToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      type: 'access' // token类型标识
    };
    
    return jwt.sign(
      payload,
      config.jwt.accessToken.secret,
      { expiresIn: config.jwt.accessToken.expiresIn }
    );
  }

  /**
   * 生成Refresh Token - 只包含最少必要信息
   * @param {Object} user - 用户信息
   * @returns {string} refresh token
   */
  static generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      type: 'refresh', // token类型标识
      // 不包含敏感信息如email、name等
    };
    
    return jwt.sign(
      payload,
      config.jwt.refreshToken.secret,
      { expiresIn: config.jwt.refreshToken.expiresIn }
    );
  }

  /**
   * 验证Access Token
   * @param {string} token - access token
   * @returns {Object} 解码后的payload
   */
  static verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.accessToken.secret);
      
      // 验证token类型
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 验证Refresh Token
   * @param {string} token - refresh token
   * @returns {Object} 解码后的payload
   */
  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshToken.secret);
      
      // 验证token类型
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 解码token（不验证签名）
   * @param {string} token - JWT token
   * @returns {Object} 解码后的payload
   */
  static decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * 生成token对（access + refresh）
   * @param {Object} user - 用户信息
   * @returns {Object} { accessToken, refreshToken }
   */
  static generateTokenPair(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * 检查token是否即将过期（5分钟内）
   * @param {string} token - JWT token
   * @returns {boolean} 是否即将过期
   */
  static isTokenExpiringSoon(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = decoded.exp;
      const timeUntilExpiry = expirationTime - currentTime;
      
      // 如果5分钟内过期，返回true
      return timeUntilExpiry <= 300; // 300秒 = 5分钟
    } catch (error) {
      return true;
    }
  }

  /**
   * 获取token过期时间
   * @param {string} token - JWT token
   * @returns {Date|null} 过期时间
   */
  static getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return null;
      }
      
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * 计算refresh token的过期时间
   * @returns {Date} 过期时间
   */
  static calculateRefreshTokenExpiration() {
    const expiresIn = config.jwt.refreshToken.expiresIn;
    const now = new Date();
    
    // 解析过期时间字符串（如 '7d', '24h', '60m'）
    const timeValue = parseInt(expiresIn);
    const timeUnit = expiresIn.slice(-1);
    
    switch (timeUnit) {
      case 'd': // 天
        return new Date(now.getTime() + timeValue * 24 * 60 * 60 * 1000);
      case 'h': // 小时
        return new Date(now.getTime() + timeValue * 60 * 60 * 1000);
      case 'm': // 分钟
        return new Date(now.getTime() + timeValue * 60 * 1000);
      case 's': // 秒
        return new Date(now.getTime() + timeValue * 1000);
      default:
        // 默认7天
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}

module.exports = JWTUtils;