// 用户控制器 - 处理用户相关的业务逻辑

const { successResponse, errorResponse } = require('../utils/helpers');
const UserModel = require('../models/userModel');

class UserController {
  // 根据ID获取用户
  static async getUserById(req, res) {
    try {
      // 如果是获取当前用户profile，使用JWT中的用户ID
      const id = req.params.id || req.user.userId;
      const user = await UserModel.getUserById(id);
      
      if (!user) {
        return res.status(404).json(errorResponse('用户不存在'));
      }
      
      res.json(successResponse(user, '获取用户成功'));
    } catch (error) {
      res.status(500).json(errorResponse('获取用户失败', error.message));
    }
  }
  
  // 创建新用户
  static async createUser(req, res) {
    try {
      console.log(req.body);
      const { name, email, password } = req.body;
      
      const newUser = await UserModel.createUser({ name, email, password });
      
      res.status(201).json(successResponse(newUser, '用户创建成功'));
    } catch (error) {
      if (error.message.includes('邮箱已被注册')) {
        return res.status(400).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('创建用户失败', error.message));
    }
  }
  
  // 更新用户信息
  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const { name, email } = req.body;
      
      const updatedUser = await UserModel.updateUser(id, { name, email });
      
      res.json(successResponse(updatedUser, '用户信息更新成功'));
    } catch (error) {
      if (error.message.includes('用户不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      if (error.message.includes('邮箱已被其他用户使用')) {
        return res.status(400).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('更新用户信息失败', error.message));
    }
  }
  
  // 删除用户
  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      
      const success = await UserModel.deleteUser(id);
      
      if (success) {
        res.json(successResponse(null, '用户删除成功'));
      } else {
        res.status(404).json(errorResponse('用户不存在'));
      }
    } catch (error) {
      if (error.message.includes('用户不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('删除用户失败', error.message));
    }
  }

  // 重置密码
  static async resetPassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.userId; // 从JWT中间件获取用户ID

      // 获取用户信息
      const user = await UserModel.getUserById(userId);
      if (!user) {
        return res.status(404).json(errorResponse('用户不存在'));
      }

      // 验证旧密码
      const isOldPasswordValid = await UserModel.verifyPassword(user.email, oldPassword);
      if (!isOldPasswordValid) {
        return res.status(400).json(errorResponse('原密码错误'));
      }

      // 检查新密码与旧密码是否相同
      const bcrypt = require('bcrypt');
      const isSamePassword = await bcrypt.compare(newPassword, (await UserModel.getUserByEmail(user.email)).password);
      if (isSamePassword) {
        return res.status(400).json(errorResponse('新密码不能与原密码相同'));
      }

      // 更新密码
      await UserModel.updatePassword(userId, newPassword);
      
      // 密码修改成功后删除所有refresh token，强制用户重新登录
      await UserModel.deleteAllRefreshTokens(userId);

      res.json(successResponse(null, '密码重置成功，请重新登录'));
    } catch (error) {
      res.status(500).json(errorResponse('密码重置失败', error.message));
    }
  }

  // 更新用户基本信息（姓名和邮箱）
  static async updateUserProfile(req, res) {
    try {
      const { name, email } = req.body;
      const userId = req.user.userId; // 从JWT中间件获取用户ID
      
      // 检查至少提供一个字段
      if (!name && !email) {
        return res.status(400).json(errorResponse('请至少提供一个要更新的字段'));
      }

      const updatedUser = await UserModel.updateUser(userId, { name, email });
      
      res.json(successResponse(updatedUser, '用户信息更新成功'));
    } catch (error) {
      if (error.message.includes('用户不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      if (error.message.includes('邮箱已被其他用户使用')) {
        return res.status(400).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('更新用户信息失败', error.message));
    }
  }
}

module.exports = UserController;