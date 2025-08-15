/**
 * LLM相关的验证中间件
 */

/**
 * 验证聊天请求参数
 */
const validateChatRequest = (req, res, next) => {
  const { messages, model, stream, temperature, max_tokens } = req.body;
  
  // 验证messages
  if (!messages) {
    return res.status(400).json({
      success: false,
      message: '缺少必需参数: messages'
    });
  }
  
  if (!Array.isArray(messages)) {
    return res.status(400).json({
      success: false,
      message: 'messages必须是数组格式'
    });
  }
  
  if (messages.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'messages不能为空'
    });
  }
  
  // 验证每个消息的格式
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    if (!message.role || !message.content) {
      return res.status(400).json({
        success: false,
        message: `消息${i + 1}格式错误，需要包含role和content字段`
      });
    }
    
    if (!['system', 'user', 'assistant'].includes(message.role)) {
      return res.status(400).json({
        success: false,
        message: `消息${i + 1}的role必须是system、user或assistant`
      });
    }
    
    if (typeof message.content !== 'string' || message.content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: `消息${i + 1}的content不能为空`
      });
    }
    
    // 限制单条消息长度
    if (message.content.length > 10000) {
      return res.status(400).json({
        success: false,
        message: `消息${i + 1}内容过长，最大支持10000字符`
      });
    }
  }
  
  // 验证model（可选）
  if (model && typeof model !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'model必须是字符串类型'
    });
  }
  
  // 验证stream（可选）
  if (stream !== undefined && typeof stream !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'stream必须是布尔类型'
    });
  }
  
  // 验证temperature（可选）
  if (temperature !== undefined) {
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
      return res.status(400).json({
        success: false,
        message: 'temperature必须是0-2之间的数字'
      });
    }
  }
  
  // 验证max_tokens（可选）
  if (max_tokens !== undefined) {
    if (!Number.isInteger(max_tokens) || max_tokens < 1 || max_tokens > 8192) {
      return res.status(400).json({
        success: false,
        message: 'max_tokens必须是1-8192之间的整数'
      });
    }
  }
  
  // 限制总消息数量
  if (messages.length > 50) {
    return res.status(400).json({
      success: false,
      message: '消息数量不能超过50条'
    });
  }
  
  // 计算总字符数
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  if (totalChars > 50000) {
    return res.status(400).json({
      success: false,
      message: '消息总长度不能超过50000字符'
    });
  }
  
  next();
};

module.exports = {
  validateChatRequest
};