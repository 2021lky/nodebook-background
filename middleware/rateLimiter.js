const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

/**
 * 创建速率限制中间件
 * @param {Object} options - 配置选项
 * @param {number} options.windowMs - 时间窗口（毫秒）
 * @param {number} options.max - 最大请求次数
 * @param {string} options.message - 超限时的错误消息
 * @param {Function} options.keyGenerator - 自定义key生成器
 * @returns {Function} Express中间件
 */
const rateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 默认限制100次请求
    message: '请求过于频繁，请稍后再试',
    standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` headers
    legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: options.message || '请求过于频繁，请稍后再试',
        meta: {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.round(options.windowMs / 1000)
        }
      });
    }
  };
  
  const config = { ...defaultOptions, ...options };
  
  return rateLimit(config);
};

/**
 * 认证相关的速率限制（更严格）
 */
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 最多5次尝试
  message: '登录尝试过于频繁，请15分钟后再试'
});

/**
 * Token刷新的速率限制
 */
const refreshLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 最多10次刷新
  message: 'Token刷新过于频繁，请稍后再试',
  keyGenerator: (req) => {
    // 使用IPv6兼容的IP处理 + refreshToken作为key
    const ip = ipKeyGenerator(req);
    return ip + ':' + (req.body.refreshToken || '');
  }
});

/**
 * API通用速率限制
 */
const apiLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每15分钟1000次请求
  message: 'API请求过于频繁，请稍后再试'
});

/**
 * 文件上传速率限制
 */
const uploadLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 每分钟最多10次上传
  message: '文件上传过于频繁，请稍后再试'
});

module.exports = {
  rateLimiter,
  authLimiter,
  refreshLimiter,
  apiLimiter,
  uploadLimiter
};