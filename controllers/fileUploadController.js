const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { successResponse, errorResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.userId;
    const uploadDir = path.join(process.cwd(), 'remote', userId.toString());
    
    // 确保目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名：时间戳_UUID_原文件名
    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const fileName = `${timestamp}_${uuid}_${originalName}`;
    cb(null, fileName);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedMimeTypes = [
    'text/plain',
    'text/markdown', 
    'application/json',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/xml',
    'text/xml',
    'application/x-yaml',
    'text/yaml'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

// 创建multer实例
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

class FileUploadController {

  /**
   * 文件上传接口（支持XMLHttpRequest进度监听）
   * POST /api/upload
   */
  static async uploadFile(req, res) {
    const uploadSingle = upload.single('file');
    
    uploadSingle(req, res, (err) => {
      if (err) {
        console.error('❌ Upload error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json(errorResponse('文件大小超过限制(100MB)'));
          }
        }
        return res.status(400).json(errorResponse(err.message));
      }

      if (!req.file) {
        return res.status(400).json(errorResponse('未选择文件'));
      }

      const fileInfo = {
        id: uuidv4(),
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        fileName: req.file.filename,
        filePath: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadTime: new Date().toISOString(),
        userId: req.user.userId
      };

      console.log('📤 File uploaded successfully:', {
        fileName: fileInfo.originalName,
        size: fileInfo.size,
        userId: req.user.userId
      });

      res.json(successResponse(fileInfo, '文件上传成功'));
    });
  }
}

module.exports = FileUploadController;