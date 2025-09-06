const express = require('express');
const router = express.Router();
const LLMController = require('../controllers/llmController');
const { jwtAuth } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

router.post('/chat', 
  jwtAuth, 
  rateLimiter({
    windowMs: 60 * 1000, // 1分钟
    max: 20, // 每分钟最多20次请求
    message: 'LLM请求过于频繁，请稍后再试'
  }),
  LLMController.chat
);

/**
 * @route POST /api/llm/stop
 * @desc 停止正在进行中的回答（需要携带requestId，或传stopAll=true停止当前用户的所有请求）
 * @access Private
 * @body {
 *   requestId?: string,
 *   stopAll?: boolean
 * }
 */
router.post('/stop', 
  jwtAuth,
  rateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    message: '停止请求过于频繁，请稍后再试'
  }),
  (req, res, next) => {
    const { requestId, stopAll } = req.body || {};
    if (requestId && typeof requestId !== 'string') {
      return res.status(400).json({ success: false, message: 'requestId必须是字符串' });
    }
    if (stopAll !== undefined && typeof stopAll !== 'boolean') {
      return res.status(400).json({ success: false, message: 'stopAll必须是布尔类型' });
    }
    next();
  },
  LLMController.stop
);

module.exports = router;