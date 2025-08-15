const { successResponse, errorResponse } = require('../utils/helpers');
const UserModel = require('../models/userModel');
const JWTUtils = require('../utils/jwtUtils');
const config = require('../config/config');

class AuthController {
  // 用户登录或注册
  static async login(req, res) {
    try {
      console.log('Request body:', req);
      const { email, password, name } = req.body;
      // 首先检查用户是否存在
      const existingUser = await UserModel.getUserByEmail(email);
      let user;
      let message;
      let statusCode = 200;

      if (existingUser) {
        // 用户存在，验证密码进行登录
        user = await UserModel.verifyPassword(email, password);
        if (!user) {
          return res.status(401).json(errorResponse('密码错误'));
        }
        message = '登录成功';
      } else {
        // 用户不存在，自动注册
        if (!name) {
          return res.status(400).json(errorResponse('首次登录需要提供用户名'));
        }
        
        try {
          user = await UserModel.createUser({ name, email, password });
          message = '注册并登录成功';
          statusCode = 201;
        } catch (error) {
          if (error.message.includes('邮箱已被注册')) {
            return res.status(400).json(errorResponse('邮箱已被注册'));
          }
          throw error;
        }
      }

      // 生成双token
      const { accessToken, refreshToken } = JWTUtils.generateTokenPair(user);
      
      // 保存refresh token到数据库
      const refreshTokenExpiration = JWTUtils.calculateRefreshTokenExpiration();
      const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
      await UserModel.saveRefreshToken(user.id, refreshToken, refreshTokenExpiration, deviceInfo);

      res.status(statusCode).json(successResponse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          create_time: user.create_time
        },
        accessToken,
        refreshToken,
        isNewUser: !existingUser
      }, message));
    } catch (error) {
      res.status(500).json(errorResponse('登录失败', error.message));
    }
  }

  // 用户注册
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // 创建新用户
      const user = await UserModel.createUser({ name, email, password });

      // 生成双token
      const { accessToken, refreshToken } = JWTUtils.generateTokenPair(user);
      
      // 保存refresh token到数据库
      const refreshTokenExpiration = JWTUtils.calculateRefreshTokenExpiration();
      const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
      await UserModel.saveRefreshToken(user.id, refreshToken, refreshTokenExpiration, deviceInfo);

      res.status(201).json(successResponse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          create_time: user.create_time
        },
        accessToken,
        refreshToken
      }, '注册成功'));
    } catch (error) {
      if (error.message.includes('邮箱已被注册')) {
        return res.status(400).json(errorResponse('邮箱已被注册'));
      }
      res.status(500).json(errorResponse('注册失败', error.message));
    }
  }

  // 验证令牌
  static async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json(errorResponse('未提供访问令牌'));
      }

      const decoded = JWTUtils.verifyAccessToken(token);
      const user = await UserModel.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json(errorResponse('用户不存在'));
      }

      // 检查token是否即将过期
      const needsRefresh = JWTUtils.isTokenExpiringSoon(token);

      res.json(successResponse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          create_time: user.create_time
        },
        valid: true,
        needsRefresh
      }, '令牌验证成功'));
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(errorResponse('无效的访问令牌'));
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(errorResponse('访问令牌已过期', 'TOKEN_EXPIRED'));
      }
      res.status(500).json(errorResponse('令牌验证失败', error.message));
    }
  }

  // 刷新token
  static async refreshToken(req, res) {
    try {
      console.log('=== Refresh Token Request ===');
      console.log('Request body:', req.body);
      console.log('Request headers:', JSON.stringify(req.headers, null, 2));
      
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        console.log('❌ No refresh token provided');
        return res.status(401).json(errorResponse('未提供refresh token'));
      }

      console.log('🔍 Refresh token received:', refreshToken.substring(0, 20) + '...');

      // 验证refresh token
      const decoded = JWTUtils.verifyRefreshToken(refreshToken);
      console.log('✅ Refresh token decoded successfully:', { userId: decoded.userId, exp: decoded.exp });
      
      // 从数据库验证token记录
      const tokenRecord = await UserModel.verifyRefreshToken(refreshToken);
      if (!tokenRecord) {
        console.log('❌ Refresh token not found in database');
        return res.status(401).json(errorResponse('无效的refresh token'));
      }

      console.log('✅ Refresh token found in database:', { id: tokenRecord.id, userId: tokenRecord.user_id });

      // 获取用户信息
      const user = await UserModel.getUserById(decoded.userId);
      if (!user) {
        console.log('❌ User not found for userId:', decoded.userId);
        return res.status(401).json(errorResponse('用户不存在'));
      }

      console.log('✅ User found:', { id: user.id, email: user.email });

      // 生成新的token对
      const { accessToken, refreshToken: newRefreshToken } = JWTUtils.generateTokenPair(user);
      console.log('✅ New tokens generated');
      
      // 删除旧的refresh token
      await UserModel.deleteRefreshToken(refreshToken);
      console.log('✅ Old refresh token deleted');
      
      // 保存新的refresh token
      const refreshTokenExpiration = JWTUtils.calculateRefreshTokenExpiration();
      const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
      await UserModel.saveRefreshToken(user.id, newRefreshToken, refreshTokenExpiration, deviceInfo);
      console.log('✅ New refresh token saved');

      res.json(successResponse({
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          create_time: user.create_time
        }
      }, 'Token刷新成功'));
    } catch (error) {
      console.log('❌ Refresh token error:', error.name, error.message);
      console.log('Error stack:', error.stack);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(errorResponse('无效的refresh token'));
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(errorResponse('Refresh token已过期', 'REFRESH_TOKEN_EXPIRED'));
      }
      res.status(500).json(errorResponse('Token刷新失败', error.message));
    }
  }

  // 登出（删除refresh token）
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json(errorResponse('未提供refresh token'));
      }

      // 删除refresh token
      const deleted = await UserModel.deleteRefreshToken(refreshToken);
      
      if (deleted) {
        res.json(successResponse(null, '登出成功'));
      } else {
        res.status(400).json(errorResponse('无效的refresh token'));
      }
    } catch (error) {
      res.status(500).json(errorResponse('登出失败', error.message));
    }
  }

  // 登出所有设备
  static async logoutAll(req, res) {
    try {
      const userId = req.user.userId; // 从JWT中间件获取
      
      // 删除用户所有refresh token
      const deletedCount = await UserModel.deleteAllRefreshTokens(userId);
      
      res.json(successResponse({
        deletedTokens: deletedCount
      }, '已登出所有设备'));
    } catch (error) {
      res.status(500).json(errorResponse('登出所有设备失败', error.message));
    }
  }

  // 修改密码
  static async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.userId; // 从JWT中间件获取

      // 获取用户信息
      const user = await UserModel.getUserById(userId);
      if (!user) {
        return res.status(404).json(errorResponse('用户不存在'));
      }

      // 验证旧密码（verifyPassword 内部已经包含了获取用户信息的逻辑）
      const isOldPasswordValid = await UserModel.verifyPassword(user.email, oldPassword);
      if (!isOldPasswordValid) {
        return res.status(400).json(errorResponse('原密码错误'));
      }

      // 更新密码
      await UserModel.updatePassword(userId, newPassword);
      
      // 修改密码后删除所有refresh token，强制重新登录
      await UserModel.deleteAllRefreshTokens(userId);

      res.json(successResponse(null, '密码修改成功，请重新登录'));
    } catch (error) {
      res.status(500).json(errorResponse('修改密码失败', error.message));
    }
  }
}

module.exports = AuthController;