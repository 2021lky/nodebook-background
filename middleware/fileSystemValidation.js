/**
 * 文件系统专用验证中间件
 */

// 验证文件/文件夹名称
const validateNodeName = (req, res, next) => {
  const { name, newName } = req.body;
  const nameToValidate = name || newName;
  
  if (!nameToValidate) {
    return res.status(400).json({
      status: 'error',
      message: '名称不能为空'
    });
  }
  
  // 检查名称长度
  if (nameToValidate.length > 255) {
    return res.status(400).json({
      status: 'error',
      message: '名称长度不能超过255个字符'
    });
  }
  
  // 检查非法字符
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(nameToValidate)) {
    return res.status(400).json({
      status: 'error',
      message: '名称包含非法字符'
    });
  }
  
  // 检查保留名称（Windows系统保留名称）
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  if (reservedNames.includes(nameToValidate.toUpperCase())) {
    return res.status(400).json({
      status: 'error',
      message: '不能使用系统保留名称'
    });
  }
  
  // 检查名称不能以点开头或结尾
  if (nameToValidate.startsWith('.') || nameToValidate.endsWith('.')) {
    return res.status(400).json({
      status: 'error',
      message: '名称不能以点开头或结尾'
    });
  }
  
  next();
};

// 验证文件内容大小
const validateFileSize = (req, res, next) => {
  const { content } = req.body;
  
  if (content && typeof content === 'string') {
    const sizeInBytes = Buffer.byteLength(content, 'utf8');
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (sizeInBytes > maxSize) {
      return res.status(413).json({
        status: 'error',
        message: '文件内容过大，最大支持10MB'
      });
    }
  }
  
  next();
};

// 验证MIME类型
const validateMimeType = (req, res, next) => {
  const { mimeType } = req.body;
  
  if (mimeType) {
    const allowedMimeTypes = [
      'text/plain',
      'text/html',
      'text/css',
      'text/javascript',
      'application/json',
      'application/xml',
      'text/markdown',
      'text/csv',
      'application/sql'
    ];
    
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(400).json({
        status: 'error',
        message: '不支持的文件类型'
      });
    }
  }
  
  next();
};

// 验证搜索参数
const validateSearchParams = (req, res, next) => {
  const { query, type } = req.query;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({
      status: 'error',
      message: '搜索关键词不能为空'
    });
  }
  
  if (query.length > 100) {
    return res.status(400).json({
      status: 'error',
      message: '搜索关键词长度不能超过100个字符'
    });
  }
  
  if (type && !['file', 'folder', 'all'].includes(type)) {
    return res.status(400).json({
      status: 'error',
      message: '无效的搜索类型'
    });
  }
  
  next();
};

module.exports = {
  validateNodeName,
  validateFileSize,
  validateMimeType,
  validateSearchParams
};