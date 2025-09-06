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

      // 将 activeRequests 的值统一为对象，便于 stop 正确中止与清理
      LLMController.activeRequests.set(requestId, {
        abortController,
        response: res,
        userId
      });

      // 设置流式响应头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');

      // 客户端断开时清理
      res.on('close', () => {
        LLMController.activeRequests.delete(requestId);
      });

      // 发送请求ID
      res.write(`data: ${JSON.stringify({ type: 'start', requestId })}\n\n`);

      // 导入 fetch
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
        res.write(`error: ${JSON.stringify({ error: 'API调用失败' })}\n\n`);
        res.end();
        LLMController.activeRequests.delete(requestId);
        return;
      }

      // 处理流式数据
      response.body.on('data', (chunk) => {
        const decoded = typeof chunk === 'string'
          ? chunk
          : (Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));

        const lines = decoded.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim() === '[DONE]') {
              res.write('data: [DONE]\n\n');
              res.end();
              LLMController.activeRequests.delete(requestId);
              return;
            }
            res.write(`${line}\n\n`);
          } else if (line.startsWith('error: ')) {
            res.write(`${line}\n\n`);
          }
        }
      });

      response.body.on('end', () => {
        res.end();
        LLMController.activeRequests.delete(requestId);
      });

      response.body.on('error', (error) => {
        res.write(`error: ${JSON.stringify({ error: '流处理错误', details: error.message })}\n\n`);
        res.end();
        LLMController.activeRequests.delete(requestId);
      });

    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: '请求失败', details: error.message })}\n\n`);
      res.end();
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