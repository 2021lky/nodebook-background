const express = require('express');
const router = express.Router();
const FileUploadController = require('../controllers/fileUploadController');
const { jwtAuth } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

/**
 * 文件上传路由
 * 所有路由都需要认证
 */
router.post('/file', jwtAuth, uploadLimiter, FileUploadController.uploadFile);



module.exports = router;