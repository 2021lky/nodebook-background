require('dotenv').config();

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // API配置
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api'
  },
  
  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'nodebook'
  },
  
  // JWT配置
  jwt: {
    accessToken: {
      secret: process.env.JWT_ACCESS_SECRET || 'default_access_secret_key',
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' // 短期token，15分钟
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_key',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' // 长期token，7天
    }
  },
  
  // 有效的API密钥列表（用逗号分隔）
  validApiKeys: process.env.VALID_API_KEYS || 'demo-api-key-123',

  // LLM配置
  llm: {
    baseUrl: process.env.LLM_BASE_URL,
    apiKey: process.env.LLM_API_KEY
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }
};