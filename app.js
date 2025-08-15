const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config();

const { testConnection } = require('./config/database');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(helmet()); // 安全中间件
app.use(cors()); // 跨域中间件
app.use(morgan('combined')); // 日志中间件
app.use(bodyParser.json()); // JSON解析中间件
app.use(bodyParser.urlencoded({ extended: true })); // URL编码解析中间件

// 路由配置
const apiRoutes = require('./routes/api');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const fileSystemRoutes = require('./routes/filesystem');
const llmRoutes = require('./routes/llm');
const uploadRoutes = require('./routes/upload');
const taskRoutes = require('./routes/tasks');

app.use('/api', apiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/filesystem', fileSystemRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tasks', taskRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to NodeBook Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404错误处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
  });
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Access URL: http://localhost:${PORT}`);
  
  // 测试数据库连接
  await testConnection();
});

module.exports = app;