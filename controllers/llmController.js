const { successResponse, errorResponse } = require('../utils/helpers');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class LLMController {
  // 存储活跃的请求，用于停止功能
  static activeRequests = new Map();
  
  /**
   * 添加活跃请求到追踪器
   * @param {string} requestId 请求ID
   * @param {AbortController} abortController 中止控制器
   * @param {Response} response 响应对象
   * @param {string} userId 用户ID
   */
clear
  static addActiveRequest(requestId, abortController, response, userId) {
    LLMController.activeRequests.set(requestId, {
      abortController,
      response,
      userId,
      startTime: Date.now()
    });
  }

  /**
   * 从追踪器中移除请求
   * @param {string} requestId 请求ID
   */
  static removeActiveRequest(requestId) {
    LLMController.activeRequests.delete(requestId);
  }

  /**
   * 清理过期的请求（超过10分钟）
   */
  static cleanupExpiredRequests() {
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000;
    
    for (const [requestId, request] of LLMController.activeRequests.entries()) {
      if (now - request.startTime > tenMinutes) {
        try {
          request.abortController.abort();
          if (!request.response.headersSent) {
            request.response.end();
          }
        } catch (error) {
          console.error('❌ Error cleaning up expired request:', error);
        }
        LLMController.activeRequests.delete(requestId);
      }
    }
  }
  /**
   * 大语言模型问答接口
   * POST /api/llm/chat
   */
  static async chat(req, res) {
    try {
      const { messages, model = 'Qwen/Qwen3-8B', stream = false, temperature = 0.7, max_tokens = 2048 } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json(errorResponse('消息列表不能为空'));
      }
      
      // 验证消息格式
      for (const message of messages) {
        if (!message.role || !message.content) {
          return res.status(400).json(errorResponse('消息格式错误，需要包含role和content字段'));
        }
        if (!['system', 'user', 'assistant'].includes(message.role)) {
          return res.status(400).json(errorResponse('消息角色必须是system、user或assistant'));
        }
      }
      
      // 清理过期的活跃请求
      LLMController.cleanupExpiredRequests();
      
      const requestId = uuidv4();
      const abortController = new AbortController();
      const userId = req.user?.userId || 'anonymous';
      LLMController.addActiveRequest(requestId, abortController, res, userId);
      res.setHeader('X-Request-Id', requestId);
      
      console.log('🤖 LLM Chat request:', { 
        model, 
        messageCount: messages.length, 
        stream, 
        userId: req.user?.userId,
        requestId
      });
      
      // 构建请求数据
      const requestData = {
        model,
        messages,
        temperature,
        max_tokens,
        stream
      };
      
      // 设置请求头
      const headers = {
        'Authorization': `Bearer ${config.llm.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      if (stream) {
        // 流式响应
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
        
        // 当客户端断开时，主动中止（加 guard 避免重复 abort）
        res.on('close', () => {
            try {
                if (!abortController.signal.aborted) {
                    abortController.abort();
                }
            } catch (_) {}
            LLMController.removeActiveRequest(requestId);
        });
        
        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(config.llm.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestData),
            signal: abortController.signal
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LLM API Error:', response.status, errorText);
            res.write(`data: ${JSON.stringify({ error: 'LLM服务错误', details: errorText, requestId })}\n\n`);
            res.end();
            LLMController.removeActiveRequest(requestId);
            return;
          }
          
          // 告知客户端请求ID，便于后续停止
          res.write(`data: ${JSON.stringify({ type: 'start', requestId })}\n\n`);
          
          // 处理流式响应
          response.body.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data.trim() === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                  res.end();
                  LLMController.removeActiveRequest(requestId);
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                } catch (e) {
                  // 忽略解析错误的数据
                }
              }
            }
          });
          
          response.body.on('end', () => {
            res.end();
            LLMController.removeActiveRequest(requestId);
          });
          
          response.body.on('error', (error) => {
            // AbortError 属于预期中止，降级日志并避免再写入 SSE
            if (error?.name === 'AbortError' || error?.type === 'aborted') {
                console.debug('ℹ️ Stream aborted:', { requestId });
            } else {
                console.error('❌ Stream error:', error);
                if (!res.writableEnded) {
                    try {
                        res.write(`data: ${JSON.stringify({ error: '流式传输错误', requestId })}\n\n`);
                        res.end();
                    } catch (_) {}
                }
            }
            LLMController.removeActiveRequest(requestId);
          });
          
        } catch (error) {
          console.error('❌ LLM request error:', error);
          res.write(`data: ${JSON.stringify({ error: '请求失败', details: error.message, requestId })}\n\n`);
          res.end();
          LLMController.removeActiveRequest(requestId);
        }
      } else {
        // 非流式响应
        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(config.llm.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestData),
            signal: abortController.signal
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LLM API Error:', response.status, errorText);
            LLMController.removeActiveRequest(requestId);
            return res.status(response.status).json(errorResponse('LLM服务错误', errorText));
          }
          
          const result = await response.json();
          console.log('✅ LLM response received:', { 
            id: result.id, 
            model: result.model, 
            usage: result.usage,
            requestId
          });
          
          LLMController.removeActiveRequest(requestId);
          res.json(successResponse({ requestId, ...result }, 'LLM问答成功'));
        } catch (error) {
          console.error('❌ LLM request error:', error);
          LLMController.removeActiveRequest(requestId);
          res.status(500).json(errorResponse('LLM请求失败', error.message));
        }
      }
    } catch (error) {
      console.error('❌ Error in LLM chat:', error);
      res.status(500).json(errorResponse('LLM问答失败', error.message));
    }
  }
  
  /**
   * 基于文件内容的问答接口
   * POST /api/llm/chat-with-file
   */
  static async chatWithFile(req, res) {
    try {
      const { 
        messages, 
        fileName, 
        model = 'Qwen/Qwen3-8B', 
        stream = false, 
        temperature = 0.7, 
        max_tokens = 2048,
        includeFileContent = true
      } = req.body;
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json(errorResponse('消息列表不能为空'));
      }
      
      if (!fileName) {
        return res.status(400).json(errorResponse('文件名不能为空'));
      }
      
      // 验证消息格式
      for (const message of messages) {
        if (!message.role || !message.content) {
          return res.status(400).json(errorResponse('消息格式错误，需要包含role和content字段'));
        }
        if (!['system', 'user', 'assistant'].includes(message.role)) {
          return res.status(400).json(errorResponse('消息角色必须是system、user或assistant'));
        }
      }
      
      // 清理过期的活跃请求并初始化请求跟踪
      LLMController.cleanupExpiredRequests();
      
      const requestId = uuidv4();
      const abortController = new AbortController();
      const userId = req.user.userId;
      LLMController.addActiveRequest(requestId, abortController, res, userId);
      res.setHeader('X-Request-Id', requestId);
      
      // 读取文件内容
      const filePath = path.join(process.cwd(), 'remote', userId.toString(), fileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json(errorResponse('指定的文件不存在'));
      }
      
      let fileContent = '';
      let fileInfo = {
        fileName,
        originalName: fileName.split('_').slice(2).join('_'),
        size: 0,
        type: 'unknown'
      };
      
      try {
        const stats = fs.statSync(filePath);
        fileInfo.size = stats.size;
        
        const ext = path.extname(fileName).toLowerCase();
        const textExtensions = ['.txt', '.md', '.json', '.csv', '.log'];
        
        if (textExtensions.includes(ext)) {
          fileContent = fs.readFileSync(filePath, 'utf8');
          fileInfo.type = 'text';
          
          // 限制文件内容长度（避免token过多）
          if (fileContent.length > 10000) {
            fileContent = fileContent.substring(0, 10000) + '\n\n[文件内容过长，已截断...]';
          }
        } else {
          fileInfo.type = 'binary';
          fileContent = `[这是一个${ext}格式的文件，文件大小：${(stats.size / 1024).toFixed(2)}KB，无法直接读取内容]`;
        }
      } catch (error) {
        console.error('❌ Error reading file:', error);
        return res.status(500).json(errorResponse('读取文件失败'));
      }
      
      // 构建包含文件内容的消息
      const enhancedMessages = [...messages];
      
      if (includeFileContent && fileContent) {
        // 在第一条用户消息前插入文件内容
        const fileContextMessage = {
          role: 'system',
          content: `用户上传了一个文件：${fileInfo.originalName}\n\n文件内容：\n${fileContent}\n\n请基于这个文件内容回答用户的问题。`
        };
        
        // 找到第一条用户消息的位置
        const firstUserIndex = enhancedMessages.findIndex(msg => msg.role === 'user');
        if (firstUserIndex !== -1) {
          enhancedMessages.splice(firstUserIndex, 0, fileContextMessage);
        } else {
          enhancedMessages.unshift(fileContextMessage);
        }
      }
      
      console.log('🤖 LLM Chat with file request:', { 
        model, 
        messageCount: enhancedMessages.length, 
        stream, 
        fileName: fileInfo.originalName,
        fileSize: fileInfo.size,
        fileType: fileInfo.type,
        userId: req.user?.userId,
        requestId 
      });
      
      // 构建请求数据
      const requestData = {
        model,
        messages: enhancedMessages,
        temperature,
        max_tokens,
        stream
      };
      
      // 设置请求头
      const headers = {
        'Authorization': `Bearer ${config.llm.apiKey}`,
        'Content-Type': 'application/json'
      };
      
      if (stream) {
        // 流式响应
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 客户端断开时中止（加 guard 避免重复 abort）
        res.on('close', () => {
            try {
                if (!abortController.signal.aborted) {
                    abortController.abort();
                }
            } catch (_) {}
            LLMController.removeActiveRequest(requestId);
        });

        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(config.llm.baseUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestData),
            signal: abortController.signal
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LLM API error:', response.status, errorText);
            res.write(`data: ${JSON.stringify({
              error: true,
              message: `LLM API错误: ${response.status}`,
              fileInfo,
              requestId
            })}\n\n`);
            res.end();
            LLMController.removeActiveRequest(requestId);
            return;
          }
          
          // 发送文件信息 + 请求ID
          res.write(`data: ${JSON.stringify({
            type: 'file_info',
            fileInfo,
            requestId,
            message: `正在基于文件 "${fileInfo.originalName}" 生成回答...`
          })}\n\n`);
          
          // 通过Node流事件转发SSE内容
          response.body.on('data', (chunk) => {
            try {
              res.write(chunk);
            } catch (_) {}
          });

          response.body.on('end', () => {
            try { res.end(); } catch (_) {}
            LLMController.removeActiveRequest(requestId);
          });

          response.body.on('error', (err) => {
            // AbortError 属于预期中止，降级日志并避免再写入 SSE
            if (err?.name === 'AbortError' || err?.type === 'aborted') {
                console.debug('ℹ️ Stream aborted (file mode):', { requestId });
            } else {
                console.error('❌ Stream error (file mode):', err);
                if (!res.writableEnded) {
                    try {
                        res.write(`data: ${JSON.stringify({ error: true, message: '流式传输错误', requestId })}\n\n`);
                        res.end();
                    } catch (_) {}
                }
            }
            LLMController.removeActiveRequest(requestId);
          });
        } catch (error) {
          console.error('❌ Chat with file error:', error);
          res.status(500).json(errorResponse('基于文件的问答失败', error.message));
        }
      }
    } catch (error) {
      console.error('❌ Chat with file error:', error);
      res.status(500).json(errorResponse('基于文件的问答失败', error.message));
    }
  }

  /**
   * 获取可用的模型列表
   * GET /api/llm/models
   */
  static async getModels(req, res) {
    try {
      const models = [
        {
          id: 'Qwen/Qwen3-8B',
          name: 'Qwen3-8B',
          description: '日常问答，支持思考模式'
        },
        {
          id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
          name: 'Qwen2.5-Coder-7B-Instruct',
          description: '代码生成专用模型'
        }
      ];
      
      res.json(successResponse(models, '获取模型列表成功'));
    } catch (error) {
      console.error('❌ Error getting models:', error);
      res.status(500).json(errorResponse('获取模型列表失败', error.message));
    }
  }

  /**
   * 停止正在进行中的回答
   * POST /api/llm/stop
   * body: { requestId?: string, stopAll?: boolean }
   */
  static async stop(req, res) {
    try {
      const { requestId, stopAll = false } = req.body || {};
      const userId = req.user?.userId || 'anonymous';
      
      if (!requestId && !stopAll) {
        return res.status(400).json(errorResponse('缺少requestId或stopAll参数'));
      }
      
      // 停止指定请求
      if (requestId) {
        const tracked = LLMController.activeRequests.get(requestId);
        if (!tracked) {
          return res.status(404).json(errorResponse('未找到对应的活动请求'));
        }
        // 只能停止自己的请求
        if (tracked.userId && String(tracked.userId) !== String(userId)) {
          return res.status(403).json(errorResponse('无权停止其他用户的请求'));
        }
        try {
          tracked.abortController.abort();
          if (tracked.response && !tracked.response.writableEnded) {
            if (!tracked.response.headersSent) {
              tracked.response.setHeader('Content-Type', 'text/event-stream');
            }
            try {
              tracked.response.write(`data: ${JSON.stringify({ type: 'stopped', requestId })}\n\n`);
            } catch (_) {}
            try { tracked.response.end(); } catch (_) {}
          }
        } finally {
          LLMController.activeRequests.delete(requestId);
        }
        return res.json(successResponse({ requestId }, '已停止该回答'));
      }
      
      // 停止当前用户的所有请求
      let count = 0;
      for (const [rid, tracked] of LLMController.activeRequests.entries()) {
        if (!tracked.userId || String(tracked.userId) === String(userId)) {
          try {
            tracked.abortController.abort();
            if (tracked.response && !tracked.response.writableEnded) {
              try { tracked.response.write(`data: ${JSON.stringify({ type: 'stopped', requestId: rid })}\n\n`); } catch (_) {}
              try { tracked.response.end(); } catch (_) {}
            }
          } catch (_) {}
          LLMController.activeRequests.delete(rid);
          count += 1;
        }
      }
      return res.json(successResponse({ stopped: count }, '已停止该用户的所有回答'));
    } catch (error) {
      console.error('❌ Stop error:', error);
      res.status(500).json(errorResponse('停止回答失败', error.message));
    }
  }
}

module.exports = LLMController;