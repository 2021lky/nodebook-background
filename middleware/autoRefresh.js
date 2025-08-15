const JWTUtils = require('../utils/jwtUtils');
const UserModel = require('../models/userModel');

/**
 * 自动刷新中间件
 * 当access token即将过期时（5分钟内），自动刷新token
 */
const autoRefreshMiddleware = async (req, res, next) => {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    
    // 如果没有提供access token，跳过自动刷新
    if (!accessToken) {
      return next();
    }
    
    // 检查access token是否即将过期
    const isExpiringSoon = JWTUtils.isTokenExpiringSoon(accessToken);
    
    if (isExpiringSoon) {
      try {
        // 先验证当前access token以获取用户ID
        const decoded = JWTUtils.verifyAccessToken(accessToken);
        const userId = decoded.userId;
        
        // 从数据库查找用户的有效refresh token
        const userRefreshTokens = await UserModel.getUserRefreshTokens(userId);
        
        if (!userRefreshTokens || userRefreshTokens.length === 0) {
          return next(); // 没有有效的refresh token，继续执行
        }
        
        // 选择最新的refresh token（按创建时间排序）
        const latestRefreshToken = userRefreshTokens[0];
        
        // 验证refresh token是否有效
        try {
          JWTUtils.verifyRefreshToken(latestRefreshToken.token);
        } catch (tokenError) {
          // refresh token无效，删除它并继续执行
          await UserModel.deleteRefreshToken(latestRefreshToken.token);
          return next();
        }
        
        // 获取用户信息
        const user = await UserModel.getUserById(userId);
        if (!user) {
          return next(); // 用户不存在，继续执行
        }
        
        // 生成新的token对
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = JWTUtils.generateTokenPair(user);
        
        // 删除旧的refresh token
        await UserModel.deleteRefreshToken(latestRefreshToken.token);
        
        // 保存新的refresh token
        const refreshTokenExpiration = JWTUtils.calculateRefreshTokenExpiration();
        const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
        await UserModel.saveRefreshToken(user.id, newRefreshToken, refreshTokenExpiration, deviceInfo);
        
        // 在响应头中返回新的token
        res.setHeader('X-New-Access-Token', newAccessToken);
        res.setHeader('X-New-Refresh-Token', newRefreshToken);
        res.setHeader('X-Token-Refreshed', 'true');
        
        // 更新请求头中的access token，以便后续中间件使用
        req.headers.authorization = `Bearer ${newAccessToken}`;
        
        console.log(`自动刷新token成功，用户ID: ${userId}`);
        
      } catch (refreshError) {
        // 刷新失败，继续执行原请求
        console.log('自动刷新token失败:', refreshError.message);
      }
    }
    
    next();
  } catch (error) {
    // 自动刷新过程中出错，不影响原请求
    console.log('自动刷新中间件错误:', error.message);
    next();
  }
};

module.exports = {
  autoRefreshMiddleware
};