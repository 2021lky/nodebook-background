const express = require('express');
const router = express.Router();
const FileSystemController = require('../controllers/fileSystemController');
const { jwtAuth: authenticateToken } = require('../middleware/auth');
const { validateRequestBody } = require('../middleware/validation');
const {
  validateNodeName,
  validateFileSize,
  validateMimeType,
  validateSearchParams
} = require('../middleware/fileSystemValidation');

// 所有文件系统路由都需要身份验证
router.use(authenticateToken);

/**
 * 文件树管理路由
 */

// 获取用户文件树
router.get('/tree', FileSystemController.getFileTree);

// 获取文件夹统计信息
router.get('/stats/:folderId?', FileSystemController.getFolderStats);

// 搜索文件和文件夹
router.get('/search', validateSearchParams, FileSystemController.searchNodes);

/**
 * 文件夹管理路由
 */

// 创建文件夹
router.post('/folder', 
  validateRequestBody, 
  validateNodeName,
  FileSystemController.createFolder
);

/**
 * 文件管理路由
 */

// 创建文件
router.post('/file', 
  validateRequestBody, 
  validateNodeName, 
  validateFileSize, 
  validateMimeType,
  FileSystemController.createFile
);

// 获取文件内容
router.get('/file/:fileId', FileSystemController.getFileContent);

// 更新文件内容
router.put('/file/:fileId',
  validateRequestBody, 
  validateFileSize, 
  FileSystemController.updateFileContent
);

/**
 * 通用节点操作路由
 */

// 重命名文件或文件夹
router.put('/rename/:nodeId', 
  validateRequestBody, 
  validateNodeName, 
  FileSystemController.renameNode
);

// 移动文件或文件夹
router.put('/move/:nodeId', 
  validateRequestBody,
  FileSystemController.moveNode
);

// 删除文件或文件夹
router.delete('/:nodeId', FileSystemController.deleteNode);

module.exports = router;