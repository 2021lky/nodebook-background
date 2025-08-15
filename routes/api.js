const express = require('express');
const router = express.Router();

// API状态检查
router.get('/status', (req, res) => {
  res.json({
    status: 'success',
    message: 'API is working properly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 获取API信息
router.get('/info', (req, res) => {
  res.json({
    name: 'NodeBook Backend API',
    version: '1.0.0',
    description: 'Backend service for nodebook application',
    endpoints: {
      status: '/api/status',
      info: '/api/info',
      users: '/api/users'
    }
  });
});

// 示例数据接口
router.get('/data', (req, res) => {
  const sampleData = {
    books: [
      { id: 1, title: 'Node.js实战', author: '张三', category: '技术' },
      { id: 2, title: 'JavaScript高级程序设计', author: '李四', category: '技术' },
      { id: 3, title: '深入理解计算机系统', author: '王五', category: '计算机科学' }
    ],
    categories: ['技术', '计算机科学', '文学', '历史'],
    total: 3
  };
  
  res.json({
    status: 'success',
    data: sampleData
  });
});

module.exports = router;