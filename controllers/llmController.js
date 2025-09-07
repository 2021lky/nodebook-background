const { successResponse, errorResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config.js');

class LLMController {
  // 存储活跃的请求，用于停止功能
  static activeRequests = new Map()

  static async chat(req, res) {
    const requestId = uuidv4();
    try {
      const { messages, model = 'Qwen/Qwen2.5-7B-Instruct' } = req.body;
      const userId = req.user?.userId || 'anonymous';
      const abortController = new AbortController();
  
      // 将活动请求存为对象，便于 stop 使用
      LLMController.activeRequests.set(requestId, {
        abortController,
        response: res,
        userId
      });
  
      // 更符合 SSE 的头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
  
      let finished = false;
      const safeWrite = (chunk) => {
        if (finished || res.writableEnded) return;
        try { res.write(chunk); } catch (_) {}
      };
      const safeEnd = () => {
        if (finished) return;
        finished = true;
        try { if (!res.writableEnded) res.end(); } catch (_) {}
        LLMController.activeRequests.delete(requestId);
      };
  
      // 客户端断开时清理
      res.on('close', () => {
        try { abortController.abort(); } catch (_) {}
        safeEnd();
      });
  
      // 发送请求ID
      safeWrite(`data: ${JSON.stringify({ type: 'start', requestId })}\n\n`);
  
      // 导入 fetch 并发起请求
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(config.llm.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.llm.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: messages,
          stream: true
        }),
        signal: abortController.signal
      });
  
      if (!response.ok) {
        safeWrite(`error: ${JSON.stringify({ error: 'API调用失败' })}\n\n`);
        safeEnd();
        return;
      }
  
      // 处理流式数据（使用安全写入）
      const onData = (chunk) => {
        if (finished || res.writableEnded) return;
        const decoded = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        const lines = decoded.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              safeWrite('data: [DONE]\n\n');
              safeEnd();
              return;
            }
            safeWrite(`${line}\n\n`);
          } else if (line.startsWith('error: ')) {
            safeWrite(`${line}\n\n`);
          }
        }
      };
  
      const onEnd = () => {
        safeEnd();
      };
  
      const onError = (error) => {
        // AbortError 多由 stop/客户端断开引起，避免写入已结束响应
        if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
          // 可降级日志
          // console.debug('Stream aborted:', requestId);
          safeEnd();
          return;
        }
        safeWrite(`error: ${JSON.stringify({ error: '流处理错误', details: error.message })}\n\n`);
        safeEnd();
      };
  
      response.body.on('data', onData);
      response.body.on('end', onEnd);
      response.body.on('error', onError);
  
    } catch (error) {
      // 捕获同步/初始化阶段错误
      try {
        const msg = { error: '请求失败', details: error.message };
        res.writableEnded ? null : res.write(`data: ${JSON.stringify(msg)}\n\n`);
      } catch (_) {}
      try { res.writableEnded ? null : res.end(); } catch (_) {}
      LLMController.activeRequests.delete(requestId);
    }
  }

  static async stop(req, res) {
    try {
      const { requestId, stopAll = false } = req.body || {};
      const userId = req.user?.userId || 'anonymous';
      console.log(requestId, stopAll, userId)
      if (!requestId && !stopAll) {
        return res.status(400).json(errorResponse('缺少requestId或stopAll参数'));
      }

      // 停止指定请求
      if (requestId) {
        const tracked = LLMController.activeRequests.get(requestId);
        if (!tracked) {
          return res.status(404).json(errorResponse('未找到对应的活动请求'));
        }
        // 兼容两种形态：对象形态 { abortController, response, userId } 与旧的 AbortController 实例
        const abortCtrl = tracked?.abortController || (typeof tracked?.abort === 'function' ? tracked : null);
        const resRef = tracked?.response;

        // 权限校验（仅当 tracked 里带有 userId 时校验）
        if (tracked?.userId && String(tracked.userId) !== String(userId)) {
          return res.status(403).json(errorResponse('无权停止其他用户的请求'));
        }

        if (!abortCtrl) {
          // 找不到可中止的控制器，说明请求已结束或数据不完整
          LLMController.activeRequests.delete(requestId);
          return res.status(410).json(errorResponse('请求已结束或不可中止'));
        }

        try {
          abortCtrl.abort();
          if (resRef && !resRef.writableEnded) {
            if (!resRef.headersSent) {
              resRef.setHeader('Content-Type', 'text/event-stream');
            }
            try { resRef.write(`data: ${JSON.stringify({ type: 'stopped', requestId })}\n\n`); } catch (_) {}
            try { resRef.end(); } catch (_) {}
          }
        } finally {
          LLMController.activeRequests.delete(requestId);
        }
        return res.json(successResponse({ requestId }, '已停止该回答'));
      }

      // 停止当前用户的所有请求
      let count = 0;
      for (const [rid, tracked] of LLMController.activeRequests.entries()) {
        // 仅停止当前用户的（无 userId 视为当前用户可停，保持向后兼容）
        if (!tracked?.userId || String(tracked.userId) === String(userId)) {
          const abortCtrl = tracked?.abortController || (typeof tracked?.abort === 'function' ? tracked : null);
          const resRef = tracked?.response;

          try {
            if (abortCtrl) {
              abortCtrl.abort();
            }
            if (resRef && !resRef.writableEnded) {
              try { resRef.write(`data: ${JSON.stringify({ type: 'stopped', requestId: rid })}\n\n`); } catch (_) {}
              try { resRef.end(); } catch (_) {}
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