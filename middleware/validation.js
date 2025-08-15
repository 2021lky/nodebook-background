// 请求验证中间件

// 验证用户创建请求
const validateUserCreation = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];
  
  // 验证姓名
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('姓名必须是至少2个字符的字符串');
  }
  
  // 验证邮箱
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('请提供有效的邮箱地址');
  }
  
  // 验证密码
  if (!password || typeof password !== 'string') {
    errors.push('密码不能为空');
  } else if (password.length < 6) {
    errors.push('密码长度不能少于6位');
  } else if (password.length > 255) {
    errors.push('密码长度不能超过255位');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: '请求验证失败',
      errors: errors
    });
  }
  
  next();
};

// 验证用户更新请求
const validateUserUpdate = (req, res, next) => {
  const { name, email } = req.body;
  const errors = [];
  
  // 至少需要一个字段进行更新
  if (!name && !email) {
    errors.push('至少需要提供一个要更新的字段');
  }
  
  // 验证姓名（如果提供）
  if (name && (typeof name !== 'string' || name.trim().length < 2)) {
    errors.push('姓名必须是至少2个字符的字符串');
  }
  
  // 验证邮箱（如果提供）
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    errors.push('请提供有效的邮箱地址');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      message: '请求验证失败',
      errors: errors
    });
  }
  
  next();
};

// 验证ID参数（UUID格式）
const validateId = (req, res, next) => {
  const id = req.params.id;
  
  // UUID格式验证（简单版本）
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
    return res.status(400).json({
      status: 'error',
      message: 'ID必须是有效的UUID格式'
    });
  }
  
  next();
};

// 通用请求体验证
const validateRequestBody = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: '请求体不能为空'
      });
    }
  }
  next();
};

// 处理express-validator验证错误的中间件
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: '请求验证失败',
      errors: errors.array().map(error => error.msg)
    });
  }
  next();
};

module.exports = {
  validateUserCreation,
  validateUserUpdate,
  validateId,
  validateRequestBody,
  handleValidationErrors
};