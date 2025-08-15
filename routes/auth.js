const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { validateUserCreation } = require('../middleware/validation');
const { jwtAuth } = require('../middleware/auth');

// 用户登录或注册验证中间件
const validateLogin = (req, res, next) => {
  console.log('Request body:', req);
  const { email, password, name } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('邮箱不能为空');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('邮箱格式不正确');
  }

  if (!password || typeof password !== 'string') {
    errors.push('密码不能为空');
  } else if (password.length < 6) {
    errors.push('密码长度不能少于6位');
  } else if (password.length > 255) {
    errors.push('密码长度不能超过255位');
  }

  // name字段是可选的，但如果提供了需要验证格式
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      errors.push('用户名不能为空');
    } else if (name.length > 50) {
      errors.push('用户名长度不能超过50位');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: '请求参数验证失败',
      errors
    });
  }

  next();
};

// 修改密码验证中间件
const validatePasswordChange = (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const errors = [];

  if (!oldPassword || typeof oldPassword !== 'string') {
    errors.push('原密码不能为空');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    errors.push('新密码不能为空');
  } else if (newPassword.length < 6) {
    errors.push('新密码长度不能少于6位');
  } else if (newPassword.length > 255) {
    errors.push('新密码长度不能超过255位');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: '请求参数验证失败',
      errors
    });
  }

  next();
};

// 用户登录
router.post('/login', validateLogin, AuthController.login);

// 用户注册
router.post('/register', validateUserCreation, AuthController.register);

// 验证令牌
router.get('/verify', AuthController.verifyToken);

// 刷新token
router.post('/refresh', AuthController.refreshToken);

// 登出（删除refresh token）
router.post('/logout', AuthController.logout);

// 登出所有设备（需要认证）
router.post('/logout-all', jwtAuth, AuthController.logoutAll);

// 修改密码（需要认证）
router.post('/change-password', jwtAuth, validatePasswordChange, AuthController.changePassword);

module.exports = router;