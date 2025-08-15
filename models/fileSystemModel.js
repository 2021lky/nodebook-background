const { pool, query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
class FileSystemModel {
  /**
   * 计算文件内容的SHA256哈希值
   * @param {string} content - 文件内容
   * @returns {string} 哈希值
   */
  static calculateFileHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * 获取文件存储路径
   * @param {string} userId - 用户ID
   * @param {string} fileId - 文件ID
   * @returns {string} 文件存储路径
   */
  static getFilePath(userId, fileId) {
    const storageDir = path.join(process.cwd(), 'storage', 'files', userId);
    return path.join(storageDir, `${fileId}.dat`);
  }

  /**
   * 确保存储目录存在
   * @param {string} userId - 用户ID
   */
  static ensureStorageDir(userId) {
    const storageDir = path.join(process.cwd(), 'storage', 'files', userId);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  }

  /**
   * 保存文件内容到文件系统
   * @param {string} userId - 用户ID
   * @param {string} fileId - 文件ID
   * @param {string} content - 文件内容
   * @returns {string} 文件存储路径
   */
  static async saveFileContent(userId, fileId, content) {
    this.ensureStorageDir(userId);
    const filePath = this.getFilePath(userId, fileId);
    
    // 使用gzip压缩存储
    const compressed = zlib.gzipSync(content, { level: 6 });
    fs.writeFileSync(filePath, compressed);
    
    return filePath;
  }

  /**
   * 从文件系统读取文件内容
   * @param {string} filePath - 文件路径
   * @returns {string} 文件内容
   */
  static async readFileContent(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }
    
    try {
      // 读取文件内容
      const fileData = fs.readFileSync(filePath);
      
      // 检查文件是否为空
      if (fileData.length === 0) {
        return '';
      }
      
      // 检查是否为gzip格式（前两个字节应该是0x1f, 0x8b）
      if (fileData.length >= 2 && fileData[0] === 0x1f && fileData[1] === 0x8b) {
        // 是gzip格式，进行解压缩
        const content = zlib.gunzipSync(fileData).toString('utf8');
        return content;
      } else {
        // 不是gzip格式，直接返回文本内容
        console.warn('⚠️ File is not in gzip format, reading as plain text:', filePath);
        return fileData.toString('utf8');
      }
    } catch (error) {
      console.error('❌ Error reading file content:', error);
      if (error.message.includes('incorrect header check')) {
        // gzip解压缩失败，尝试作为普通文本读取
        try {
          const fileData = fs.readFileSync(filePath);
          console.warn('⚠️ Gzip decompression failed, reading as plain text:', filePath);
          return fileData.toString('utf8');
        } catch (textError) {
          throw new Error(`文件读取失败: ${textError.message}`);
        }
      }
      throw new Error(`文件内容解析失败: ${error.message}`);
    }
  }
  /**
   * 获取用户的文件树结构
   * @param {string} userId - 用户ID
   * @param {string} parentId - 父节点ID，null表示根目录，主要用于搜索时使用
   * @returns {Array} 文件树数据
   */
  static async getUserFileTree(userId, parentId = null) {
    try {
      console.log('📁 Getting file tree for user:', userId, 'parent:', parentId);
      
      const sql = `
        SELECT id, name, type, path, size, mime_type, created_at, updated_at,
               CASE WHEN type = 'file' THEN 1 ELSE 0 END as isLeaf
        FROM file_nodes 
        WHERE user_id = ? AND parent_id ${parentId ? '= ?' : 'IS NULL'} AND is_deleted = 0
        ORDER BY type ASC, name ASC
      `;
      
      const params = parentId ? [userId, parentId] : [userId];
      const results = await query(sql, params);
      
      // 递归获取子节点
      const treeData = [];
      for (const node of results) {
        const treeNode = {
          key: node.id,
          title: node.name,
          isLeaf: node.type === 'file',
          type: node.type,
          path: node.path,
          size: node.size,
          mimeType: node.mime_type,
          createdAt: node.created_at,
          updatedAt: node.updated_at
        };
        
        // 如果是文件夹，递归获取子节点
        if (node.type === 'folder') {
          treeNode.children = await this.getUserFileTree(userId, node.id);
        }
        
        treeData.push(treeNode);
      }
      
      console.log(`✅ Found ${treeData.length} nodes`);
      return treeData;
    } catch (error) {
      console.error('❌ Error getting file tree:', error);
      throw error;
    }
  }

  /**
   * 创建文件夹
   * @param {string} userId - 用户ID
   * @param {string} name - 文件夹名称
   * @param {string} parentId - 父文件夹ID
   * @returns {Object} 创建的文件夹信息
   */
  static async createFolder(userId, name, parentId = null) {
    try {
      console.log('📁 Creating folder:', { userId, name, parentId });
      
      // 检查同级目录下是否已存在同名文件夹
      const existsQuery = `
        SELECT id FROM file_nodes 
        WHERE user_id = ? AND parent_id ${parentId ? '= ?' : 'IS NULL'} 
        AND name = ? AND is_deleted = 0
      `;
      const existsParams = parentId ? [userId, parentId, name] : [userId, name];
      const existing = await query(existsQuery, existsParams);
      
      if (existing.length > 0) {
        throw new Error('同级目录下已存在同名文件或文件夹');
      }
      
      // 构建路径
      let path = name;
      if (parentId) {
        const parentResult = await query(
          'SELECT path FROM file_nodes WHERE id = ? AND user_id = ?',
          [parentId, userId]
        );
        if (parentResult.length === 0) {
          throw new Error('父文件夹不存在');
        }
        path = `${parentResult[0].path}/${name}`;
      }
      
      const folderId = uuidv4();
      const insertQuery = `
        INSERT INTO file_nodes (id, user_id, parent_id, name, type, path, size)
        VALUES (?, ?, ?, ?, 'folder', ?, 0)
      `;
      
      await query(insertQuery, [folderId, userId, parentId, name, path]);
      
      console.log('✅ Folder created successfully:', folderId);
      return {
        id: folderId,
        name,
        type: 'folder',
        path,
        parentId,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      throw error;
    }
  }

  /**
   * 创建文件
   * @param {string} userId - 用户ID
   * @param {string} name - 文件名称
   * @param {string} content - 文件内容
   * @param {string} parentId - 父文件夹ID
   * @param {string} mimeType - 文件类型
   * @returns {Object} 创建的文件信息
   */
  static async createFile(userId, name, content = '', parentId = null, mimeType = 'text/plain') {
    try {
      console.log('📄 Creating file:', { userId, name, parentId, mimeType });
      
      // 检查同级目录下是否已存在同名文件
      const existsQuery = `
        SELECT id FROM file_nodes 
        WHERE user_id = ? AND parent_id ${parentId ? '= ?' : 'IS NULL'} 
        AND name = ? AND is_deleted = 0
      `;
      const existsParams = parentId ? [userId, parentId, name] : [userId, name];
      const existing = await query(existsQuery, existsParams);
      
      if (existing.length > 0) {
        throw new Error('同级目录下已存在同名文件或文件夹');
      }
      
      // 构建路径
      let nodePath = name;
      if (parentId) {
        const parentResult = await query(
          'SELECT path FROM file_nodes WHERE id = ? AND user_id = ?',
          [parentId, userId]
        );
        if (parentResult.length === 0) {
          throw new Error('父文件夹不存在');
        }
        nodePath = `${parentResult[0].path}/${name}`;
      }
      
      const fileId = uuidv4();
      const size = Buffer.byteLength(content, 'utf8');
      const fileHash = this.calculateFileHash(content);
      
      // 保存文件内容到文件系统
      const filePath = await this.saveFileContent(userId, fileId, content);
      
      const insertQuery = `
        INSERT INTO file_nodes (id, user_id, parent_id, name, type, path, size, file_path, file_hash, mime_type)
        VALUES (?, ?, ?, ?, 'file', ?, ?, ?, ?, ?)
      `;
      
      await query(insertQuery, [fileId, userId, parentId, name, nodePath, size, filePath, fileHash, mimeType]);
      
      console.log('✅ File created successfully:', fileId);
      return {
        id: fileId,
        name,
        type: 'file',
        path: nodePath,
        size,
        mimeType,
        parentId,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('❌ Error creating file:', error);
      throw error;
    }
  }

  /**
   * 重命名文件或文件夹
   * @param {string} userId - 用户ID
   * @param {string} nodeId - 节点ID
   * @param {string} newName - 新名称
   * @returns {Object} 更新后的节点信息
   */
  static async renameNode(userId, nodeId, newName) {
    try {
      console.log('✏️ Renaming node:', { userId, nodeId, newName });
      
      // 获取当前节点信息
        const currentNode = await query(
          'SELECT name, path, parent_id FROM file_nodes WHERE id = ? AND user_id = ? AND is_deleted = 0',
          [nodeId, userId]
        );
      
      if (currentNode.length === 0) {
        throw new Error('文件或文件夹不存在');
      }
      
      const node = currentNode[0];
      
      // 检查同级目录下是否已存在同名文件
      const existsQuery = `
        SELECT id FROM file_nodes 
        WHERE user_id = ? AND parent_id ${node.parent_id ? '= ?' : 'IS NULL'} 
        AND name = ? AND id != ? AND is_deleted = 0
      `;
      const existsParams = node.parent_id 
        ? [userId, node.parent_id, newName, nodeId] 
        : [userId, newName, nodeId];
      const existing = await query(existsQuery, existsParams);
      
      if (existing.length > 0) {
        throw new Error('同级目录下已存在同名文件或文件夹');
      }
      
      // 构建新路径
      const oldPath = node.path;
      const pathParts = oldPath.split('/');
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join('/');
      
      // 更新节点
        await query(
          'UPDATE file_nodes SET name = ?, path = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
          [newName, newPath, nodeId, userId]
        );
      
      // 如果是文件夹，需要更新所有子节点的路径
      if (node.type === 'folder') {
        await this.updateChildrenPaths(userId, nodeId, oldPath, newPath);
      }
      
      console.log('✅ Node renamed successfully');
      return {
        id: nodeId,
        name: newName,
        path: newPath,
        type: node.type
      };
    } catch (error) {
      console.error('❌ Error renaming node:', error);
      throw error;
    }
  }

  /**
   * 删除文件或文件夹（软删除）
   * @param {string} userId - 用户ID
   * @param {string} nodeId - 节点ID
   * @returns {boolean} 删除是否成功
   */
  static async deleteNode(userId, nodeId) {
    try {
      console.log('🗑️ Deleting node:', { userId, nodeId });
      
      // 检查节点是否存在
      const node = await query(
        'SELECT type FROM file_nodes WHERE id = ? AND user_id = ? AND is_deleted = 0',
        [nodeId, userId]
      );
      
      if (node.length === 0) {
        throw new Error('文件或文件夹不存在');
      }
      
      // 软删除节点（包括所有子节点）
      await this.softDeleteNodeRecursive(userId, nodeId);
      
      console.log('✅ Node deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting node:', error);
      throw error;
    }
  }

  /**
   * 获取文件内容
   * @param {string} userId - 用户ID
   * @param {string} fileId - 文件ID
   * @returns {Object} 文件信息和内容
   */
  static async getFileContent(userId, fileId) {
    try {
      console.log('📖 Getting file content:', { userId, fileId });
      
      // 首先尝试新格式（file_path字段）
      const result = await query(
        `SELECT id, name, file_path, size, mime_type, path, created_at, updated_at 
         FROM file_nodes 
         WHERE id = ? AND user_id = ? AND type = 'file' AND is_deleted = 0`,
        [fileId, userId]
      );
      
      if (result.length === 0) {
        throw new Error('文件不存在');
      }
      
      const fileInfo = result[0];
      
      // 从文件系统读取内容
      const content = await this.readFileContent(fileInfo.file_path);
      
      console.log('✅ File content retrieved');
      return {
        ...fileInfo,
        content
      };
    } catch (error) {
      console.error('❌ Error getting file content:', error);
      throw error;
    }
  }

  /**
   * 更新文件内容
   * @param {string} userId - 用户ID
   * @param {string} fileId - 文件ID
   * @param {string} content - 新内容
   * @returns {Object} 更新后的文件信息
   */
  static async updateFileContent(userId, fileId, content) {
    try {
      console.log('💾 Updating file content:', { userId, fileId });
      
      // 首先检查文件是否存在
      const fileResult = await query(
        `SELECT file_path FROM file_nodes 
         WHERE id = ? AND user_id = ? AND type = 'file' AND is_deleted = 0`,
        [fileId, userId]
      );
      
      if (fileResult.length === 0) {
        throw new Error('文件不存在');
      }
      
      const size = Buffer.byteLength(content, 'utf8');
      const fileHash = this.calculateFileHash(content);
      
      // 更新文件系统中的内容
      await this.saveFileContent(userId, fileId, content);
      
      // 更新数据库记录
      const result = await query(
        `UPDATE file_nodes 
         SET size = ?, file_hash = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ? AND user_id = ? AND type = 'file' AND is_deleted = 0`,
        [size, fileHash, fileId, userId]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('文件更新失败');
      }
      
      console.log('✅ File content updated');
      return { id: fileId, size, updatedAt: new Date() };
    } catch (error) {
      console.error('❌ Error updating file content:', error);
      throw error;
    }
  }

  // 私有方法：递归更新子节点路径
  static async updateChildrenPaths(userId, parentId, oldParentPath, newParentPath) {
    try {
      const children = await query(
        'SELECT id, path, type FROM file_nodes WHERE parent_id = ? AND user_id = ? AND is_deleted = 0',
        [parentId, userId]
      );
      
      for (const child of children) {
        const newChildPath = child.path.replace(oldParentPath, newParentPath);
        
        await query(
          'UPDATE file_nodes SET path = ? WHERE id = ? AND user_id = ?',
          [newChildPath, child.id, userId]
        );
        
        // 如果子节点是文件夹，递归更新其子节点
        if (child.type === 'folder') {
          await this.updateChildrenPaths(userId, child.id, child.path, newChildPath);
        }
      }
    } catch (error) {
      console.error('❌ Error updating children paths:', error);
      throw error;
    }
  }

  /**
   * 迁移旧格式文件（从content字段迁移到文件系统）
   * @param {string} userId - 用户ID
   * @param {string} fileId - 文件ID
   */
  static async migrateLegacyFile(userId, fileId) {
    try {
      // 查询旧格式文件（包含content字段）
      const legacyResult = await query(
        `SELECT content FROM file_nodes 
         WHERE id = ? AND user_id = ? AND type = 'file' AND is_deleted = 0`,
        [fileId, userId]
      );
      
      if (legacyResult.length === 0 || !legacyResult[0].content) {
        throw new Error('旧格式文件不存在或内容为空');
      }
      
      const content = legacyResult[0].content;
      const fileHash = this.calculateFileHash(content);
      const filePath = this.getFilePath(userId, fileId);
      
      // 保存内容到文件系统
      await this.saveFileContent(userId, fileId, content);
      
      // 更新数据库记录，添加file_path和file_hash，移除content
      await query(
        `UPDATE file_nodes 
         SET file_path = ?, file_hash = ?, content = NULL 
         WHERE id = ? AND user_id = ?`,
        [filePath, fileHash, fileId, userId]
      );
      
      console.log('✅ Legacy file migrated successfully:', fileId);
    } catch (error) {
      console.error('❌ Error migrating legacy file:', error);
      throw error;
    }
  }

  // 私有方法：递归软删除节点
  static async softDeleteNodeRecursive(userId, nodeId) {
    try {
      // 先软删除所有子节点
      const children = await query(
        'SELECT id FROM file_nodes WHERE parent_id = ? AND user_id = ? AND is_deleted = 0',
        [nodeId, userId]
      );
      
      for (const child of children) {
        await this.softDeleteNodeRecursive(userId, child.id);
      }
      
      // 获取当前节点信息，如果是文件则删除文件系统中的文件
      const nodeInfo = await query(
        'SELECT type, file_path FROM file_nodes WHERE id = ? AND user_id = ? AND is_deleted = 0',
        [nodeId, userId]
      );
      
      if (nodeInfo.length > 0 && nodeInfo[0].type === 'file' && nodeInfo[0].file_path) {
        try {
          // 删除文件系统中的文件
          if (fs.existsSync(nodeInfo[0].file_path)) {
            fs.unlinkSync(nodeInfo[0].file_path);
            console.log('🗑️ Physical file deleted:', nodeInfo[0].file_path);
          }
        } catch (fileError) {
          console.warn('⚠️ Warning: Could not delete physical file:', fileError.message);
          // 继续执行数据库删除，即使物理文件删除失败
        }
      }
      
      // 软删除当前节点
      await query(
        'UPDATE file_nodes SET is_deleted = 1 WHERE id = ? AND user_id = ?',
        [nodeId, userId]
      );
    } catch (error) {
      console.error('❌ Error in recursive soft delete:', error);
      throw error;
    }
  }
}

module.exports = FileSystemModel;