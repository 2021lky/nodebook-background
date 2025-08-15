// 验证客户端发送的 JWT 令牌是否有效，以此确认请求者的身份是否合法，防止未授权的访问
const jwtAuth = (req, res, next) => {
  try {
    // 从请求头的authorization字段中提取令牌（通常格式为Bearer <token>）
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: '未提供访问令牌'
      });
    }
    
    const JWTUtils = require('../utils/jwtUtils');
    
    const decoded = JWTUtils.verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: '无效的访问令牌'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: '访问令牌已过期',
        meta: {
          code: 'TOKEN_EXPIRED'
        }
      });
    }
    res.status(500).json({
      status: 'error',
      message: '令牌验证失败'
    });
  }
};

module.exports = {
  jwtAuth
};