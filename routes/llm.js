const express = require('express');
const router = express.Router();
const LLMController = require('../controllers/llmController');
const { jwtAuth } = require('../middleware/auth');
const { validateChatRequest } = require('../middleware/llmValidation');
const { rateLimiter } = require('../middleware/rateLimiter');

/**
 * @route POST /api/llm/chat
 * @desc 大语言模型问答接口
 * @access Private
 * @body {
 *   messages: Array<{role: string, content: string}>, // 必需，对话消息列表
 *   model?: string, // 可选，模型名称，默认为Qwen/Qwen2.5-7B-Instruct
 *   stream?: boolean, // 可选，是否流式输出，默认false
 *   temperature?: number, // 可选，温度参数0-2，默认0.7
 *   max_tokens?: number // 可选，最大token数1-8192，默认2048
 * }
 * @example
 * POST /api/llm/chat
 * {
 *   "messages": [
 *     {"role": "user", "content": "你好，请介绍一下自己"}
 *   ],
 *   "stream": true
 * }
 */
router.post('/chat', 
  jwtAuth, 
  rateLimiter({
    windowMs: 60 * 1000, // 1分钟
    max: 20, // 每分钟最多20次请求
    message: 'LLM请求过于频繁，请稍后再试'
  }),
  validateChatRequest, 
  LLMController.chat
);

/**
 * @route POST /api/llm/chat-with-file
 * @desc 基于文件内容的大语言模型问答接口
 * @access Private
 * @body {
 *   messages: Array<{role: string, content: string}>, // 必需，对话消息列表
 *   fileName: string, // 必需，要基于的文件名（存储在remote文件夹中）
 *   model?: string, // 可选，模型名称，默认为Qwen/Qwen3-8B
 *   stream?: boolean, // 可选，是否流式输出，默认false
 *   temperature?: number, // 可选，温度参数0-2，默认0.7
 *   max_tokens?: number, // 可选，最大token数1-8192，默认2048
 *   includeFileContent?: boolean // 可选，是否包含文件内容，默认true
 * }
 * @example
 * POST /api/llm/chat-with-file
 * {
 *   "messages": [
 *     {"role": "user", "content": "请总结这个文件的主要内容"}
 *   ],
 *   "fileName": "1703123456789_abc123_document.txt",
 *   "stream": false
 * }
 */
router.post('/chat-with-file', 
  jwtAuth, 
  rateLimiter({
    windowMs: 60 * 1000, // 1分钟
    max: 10, // 每分钟最多10次请求（比普通聊天更严格）
    message: '基于文件的LLM请求过于频繁，请稍后再试'
  }),
  validateChatRequest, 
  LLMController.chatWithFile
);

/**
 * @route GET /api/llm/models
 * @desc 获取可用的模型列表
 * @access Private
 * @example
 * GET /api/llm/models
 */
router.get('/models', 
  jwtAuth, 
  LLMController.getModels
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