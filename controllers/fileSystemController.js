const { successResponse, errorResponse } = require('../utils/helpers');
const FileSystemModel = require('../models/fileSystemModel');

class FileSystemController {
  /**
   * 获取用户文件树
   * GET /api/filesystem/tree
   */
  static async getFileTree(req, res) {
    try {
      const userId = req.user.userId; // 从JWT中间件获取
      const { parentId } = req.query;
      
      console.log('📁 Getting file tree for user:', userId);
      
      let fileTree = await FileSystemModel.getUserFileTree(userId, parentId || null);
      
      // 如果是根目录查询且没有任何文件或文件夹，创建默认文件夹
      if (!parentId && fileTree.length === 0) {
        // 创建默认文件夹
        const defaultFolders = [
          { name: '默认文件夹', description: '系统创建默认文件夹' }
        ];
        // 添加到数据库中
        for (const folderInfo of defaultFolders) {
          try {
            await FileSystemModel.createFolder(userId, folderInfo.name, null);
          } catch (folderError) {
            console.warn(`⚠️ Failed to create default folder ${folderInfo.name}:`, folderError.message);
          }
        }
        // 重新获取文件树
        fileTree = await FileSystemModel.getUserFileTree(userId, parentId || null);
      }
      
      res.json(successResponse(fileTree, '获取文件树成功'));
    } catch (error) {
      console.error('❌ Error getting file tree:', error);
      res.status(500).json(errorResponse('获取文件树失败', error.message));
    }
  }

  /**
   * 创建文件夹
   * POST /api/filesystem/folder
   */
  static async createFolder(req, res) {
    try {
      const userId = req.user.userId;
      const { name, parentId } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json(errorResponse('文件夹名称不能为空'));
      }
      
      // 验证文件夹名称格式
      if (!/^[^<>:"/\\|?*]+$/.test(name)) {
        return res.status(400).json(errorResponse('文件夹名称包含非法字符'));
      }
      
      console.log('📁 Creating folder:', { userId, name, parentId });
      
      const folder = await FileSystemModel.createFolder(userId, name.trim(), parentId || null);
      
      res.status(201).json(successResponse(folder, '文件夹创建成功'));
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      if (error.message.includes('已存在同名')) {
        return res.status(409).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('创建文件夹失败', error.message));
    }
  }

  /**
   * 创建文件
   * POST /api/filesystem/file
   */
  static async createFile(req, res) {
    try {
      const userId = req.user.userId;
      const { name, content = '', parentId, mimeType = 'text/plain' } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json(errorResponse('文件名称不能为空'));
      }
      
      // 验证文件名称格式
      if (!/^[^<>:"/\\|?*]+$/.test(name)) {
        return res.status(400).json(errorResponse('文件名称包含非法字符'));
      }
      
      console.log('📄 Creating file:', { userId, name, parentId, mimeType });
      
      const file = await FileSystemModel.createFile(
        userId, 
        name.trim(), 
        content, 
        parentId || null, 
        mimeType
      );
      
      res.status(201).json(successResponse(file, '文件创建成功'));
    } catch (error) {
      console.error('❌ Error creating file:', error);
      if (error.message.includes('已存在同名')) {
        return res.status(409).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('创建文件失败', error.message));
    }
  }

  /**
   * 重命名文件或文件夹
   * PUT /api/filesystem/rename/:nodeId
   */
  static async renameNode(req, res) {
    try {
      const userId = req.user.userId;
      const { nodeId } = req.params;
      const { newName } = req.body;
      
      if (!newName || newName.trim() === '') {
        return res.status(400).json(errorResponse('新名称不能为空'));
      }
      
      // 验证新名称格式
      if (!/^[^<>:"/\\|?*]+$/.test(newName)) {
        return res.status(400).json(errorResponse('名称包含非法字符'));
      }
      
      console.log('✏️ Renaming node:', { userId, nodeId, newName });
      
      const updatedNode = await FileSystemModel.renameNode(userId, nodeId, newName.trim());
      
      res.json(successResponse(updatedNode, '重命名成功'));
    } catch (error) {
      console.error('❌ Error renaming node:', error);
      if (error.message.includes('不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      if (error.message.includes('已存在同名')) {
        return res.status(409).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('重命名失败', error.message));
    }
  }

  /**
   * 删除文件或文件夹
   * DELETE /api/filesystem/:nodeId
   */
  static async deleteNode(req, res) {
    try {
      const userId = req.user.userId;
      const { nodeId } = req.params;
      
      console.log('🗑️ Deleting node:', { userId, nodeId });
      
      await FileSystemModel.deleteNode(userId, nodeId);
      
      res.json(successResponse(null, '删除成功'));
    } catch (error) {
      console.error('❌ Error deleting node:', error);
      if (error.message.includes('不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('删除失败', error.message));
    }
  }

  /**
   * 获取文件内容
   * GET /api/filesystem/file/:fileId
   */
  static async getFileContent(req, res) {
    try {
      const userId = req.user.userId;
      const { fileId } = req.params;
      
      console.log('📖 Getting file content:', { userId, fileId });
      
      const file = await FileSystemModel.getFileContent(userId, fileId);
      
      // 设置压缩响应头
      const acceptEncoding = req.headers['accept-encoding'] || '';
      if (acceptEncoding.includes('gzip')) {
        res.set({
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/json; charset=utf-8'
        });
        
        // 压缩响应数据
        const zlib = require('zlib');
        const responseData = JSON.stringify(successResponse(file, '获取文件内容成功'));
        const compressed = zlib.gzipSync(responseData);
        
        res.send(compressed);
      } else {
        res.json(successResponse(file, '获取文件内容成功'));
      }
    } catch (error) {
      console.error('❌ Error getting file content:', error);
      if (error.message.includes('不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('获取文件内容失败', error.message));
    }
  }

  /**
   * 更新文件内容
   * PUT /api/filesystem/file/:fileId
   */
  static async updateFileContent(req, res) {
    try {
      const userId = req.user.userId;
      const { fileId } = req.params;
      const { content } = req.body;
      
      if (content === undefined) {
        return res.status(400).json(errorResponse('文件内容不能为空'));
      }
      
      console.log('💾 Updating file content:', { userId, fileId });
      
      const updatedFile = await FileSystemModel.updateFileContent(userId, fileId, content);
      
      res.json(successResponse(updatedFile, '文件内容更新成功'));
    } catch (error) {
      console.error('❌ Error updating file content:', error);
      if (error.message.includes('不存在')) {
        return res.status(404).json(errorResponse(error.message));
      }
      res.status(500).json(errorResponse('更新文件内容失败', error.message));
    }
  }

  /**
   * 移动文件或文件夹
   * PUT /api/filesystem/move/:nodeId
   */
  static async moveNode(req, res) {
    try {
      const userId = req.user.userId;
      const { nodeId } = req.params;
      const { newParentId } = req.body;
      
      console.log('📦 Moving node:', { userId, nodeId, newParentId });
      
      // 这里可以实现移动逻辑，类似重命名但是改变parent_id和path
      // 为了简化，暂时返回未实现的响应
      res.status(501).json(errorResponse('移动功能暂未实现'));
    } catch (error) {
      console.error('❌ Error moving node:', error);
      res.status(500).json(errorResponse('移动失败', error.message));
    }
  }

  /**
   * 搜索文件和文件夹
   * GET /api/filesystem/search
   */
  static async searchNodes(req, res) {
    try {
      const userId = req.user.userId;
      const { query, type } = req.query;
      
      if (!query || query.trim() === '') {
        return res.status(400).json(errorResponse('搜索关键词不能为空'));
      }
      
      console.log('🔍 Searching nodes:', { userId, query, type });
      
      // 这里可以实现搜索逻辑
      // 为了简化，暂时返回未实现的响应
      res.status(501).json(errorResponse('搜索功能暂未实现'));
    } catch (error) {
      console.error('❌ Error searching nodes:', error);
      res.status(500).json(errorResponse('搜索失败', error.message));
    }
  }

  /**
   * 获取文件夹统计信息
   * GET /api/filesystem/stats/:folderId?
   */
  static async getFolderStats(req, res) {
    try {
      const userId = req.user.userId;
      const { folderId } = req.params;
      
      console.log('📊 Getting folder stats:', { userId, folderId });
      
      // 这里可以实现统计逻辑（文件数量、总大小等）
      // 为了简化，暂时返回未实现的响应
      res.status(501).json(errorResponse('统计功能暂未实现'));
    } catch (error) {
      console.error('❌ Error getting folder stats:', error);
      res.status(500).json(errorResponse('获取统计信息失败', error.message));
    }
  }

  /**
 * 保存工作流/脑图数据
 * POST /filesystem/workflow/:dirId
 */
static async saveWorkflow(req, res) {
  try {
    const { dirId } = req.params;
    const { nodes, edges } = req.body;
    const userId = req.user.userId;

    // 验证目录是否存在且属于当前用户
    const directory = await FileSystemModel.getNodeById(dirId, userId);
    if (!directory) {
      return res.status(404).json(errorResponse('目录不存在'));
    }
    
    if (directory.type !== 'folder') {
      return res.status(400).json(errorResponse('指定的ID不是目录'));
    }

    // 更新目录的nodes和edges字段
    await FileSystemModel.updateNodeById(dirId, userId, {
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges)
    });

    return res.status(200).json(successResponse('脑图保存成功', { dirId }));
  } catch (error) {
    console.error('保存脑图失败:', error);
    return res.status(500).json(errorResponse('保存脑图失败: ' + error.message));
  }
}

/**
 * 获取工作流/脑图数据
 * GET /filesystem/workflow/:dirId
 */
static async getWorkflow(req, res) {
  try {
    const { dirId } = req.params;
    const userId = req.user.userId;

    // 验证目录是否存在且属于当前用户
    const directory = await FileSystemModel.getNodeById(dirId, userId);
    if (!directory) {
      return res.status(404).json(errorResponse('目录不存在'));
    }
    
    if (directory.type !== 'folder') {
      return res.status(400).json(errorResponse('指定的ID不是目录'));
    }

    // 安全地解析JSON或返回空数组
    let nodes = [];
    let edges = [];
    
    if (directory.nodes) {
      try {
        // 如果已经是对象，直接使用；如果是字符串，尝试解析
        nodes = typeof directory.nodes === 'object' ? directory.nodes : JSON.parse(directory.nodes);
      } catch (e) {
        console.warn('解析nodes失败，使用空数组:', e);
      }
    }
    
    if (directory.edges) {
      try {
        // 如果已经是对象，直接使用；如果是字符串，尝试解析
        edges = typeof directory.edges === 'object' ? directory.edges : JSON.parse(directory.edges);
      } catch (e) {
        console.warn('解析edges失败，使用空数组:', e);
      }
    }

    return res.status(200).json(successResponse('获取脑图成功', { nodes, edges }));
  } catch (error) {
    console.error('获取脑图失败:', error);
    return res.status(500).json(errorResponse('获取脑图失败: ' + error.message));
  }
}
}

module.exports = FileSystemController;