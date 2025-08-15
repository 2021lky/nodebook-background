const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { jwtAuth } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

// 需要JWT认证的路由
router.use(jwtAuth);

// 获取当前用户信息
router.get('/profile', UserController.getUserById);

// 更新用户基本信息（姓名和邮箱）
router.put('/profile', [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('姓名长度必须在1-50个字符之间'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式不正确')
    .normalizeEmail()
], handleValidationErrors, UserController.updateUserProfile);

// 重置密码
router.put('/reset-password', [
  body('oldPassword')
    .notEmpty()
    .withMessage('原密码不能为空'),
  body('newPassword')
    .isLength({ min: 6, max: 255 })
    .withMessage('新密码长度必须在6-255个字符之间')
    .custom((value, { req }) => {
      if (value === req.body.oldPassword) {
        throw new Error('新密码不能与原密码相同');
      }
      return true;
    })
], handleValidationErrors, UserController.resetPassword);

// 根据ID获取用户（管理员功能）
router.get('/:id', UserController.getUserById);

// 创建新用户（管理员功能）
router.post('/', [
  body('name').notEmpty().withMessage('姓名不能为空'),
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码至少需要6个字符')
], handleValidationErrors, UserController.createUser);

// 更新用户信息（管理员功能）
router.put('/:id', UserController.updateUser);

// 删除用户（管理员功能）
router.delete('/:id', UserController.deleteUser);

module.exports = router;