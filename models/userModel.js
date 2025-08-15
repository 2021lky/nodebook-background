const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class UserModel {
  // 根据ID获取用户
  static async getUserById(id) {
    try {
      const sql = 'SELECT id, name, email, create_time FROM user WHERE id = ?';
      const users = await query(sql, [id]);
      return users[0] || null;
    } catch (error) {
      throw new Error(`获取用户失败: ${error.message}`);
    }
  }

  // 根据邮箱获取用户（包含密码，用于登录验证）
  static async getUserByEmail(email) {
    try {
      const sql = 'SELECT id, name, email, password, create_time FROM user WHERE email = ?';
      const users = await query(sql, [email]);
      return users[0] || null;
    } catch (error) {
      throw new Error(`获取用户失败: ${error.message}`);
    }
  }

  // 创建新用户
  static async createUser(userData) {
    const { name, email, password } = userData;
    
    try {
      // 检查邮箱是否已存在
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        throw new Error('邮箱已被注册');
      }

      // 生成UUID和加密密码
      const id = uuidv4();
      // 使用 bcrypt 算法对密码进行加密（哈希处理），不可逆操作
      const hashedPassword = await bcrypt.hash(password, 10);
      const createTime = new Date();

      const sql = 'INSERT INTO user (id, name, email, password, create_time) VALUES (?, ?, ?, ?, ?)';
      await query(sql, [id, name, email, hashedPassword, createTime]);

      // 返回新创建的用户信息（不包含密码）
      return await this.getUserById(id);
    } catch (error) {
      throw new Error(`创建用户失败: ${error.message}`);
    }
  }

  // 更新用户信息
  static async updateUser(id, userData) {
    const { name, email } = userData;
    
    try {
      // 检查用户是否存在
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        throw new Error('用户不存在');
      }

      // 如果更新邮箱，检查新邮箱是否已被其他用户使用
      if (email && email !== existingUser.email) {
        const emailUser = await this.getUserByEmail(email);
        if (emailUser && emailUser.id !== id) {
          throw new Error('邮箱已被其他用户使用');
        }
      }

      const updates = [];
      const params = [];

      if (name) {
        updates.push('name = ?');
        params.push(name);
      }
      if (email) {
        updates.push('email = ?');
        params.push(email);
      }

      if (updates.length === 0) {
        return existingUser; // 没有更新内容
      }

      params.push(id);
      const sql = `UPDATE user SET ${updates.join(', ')} WHERE id = ?`;
      await query(sql, params);

      // 返回更新后的用户信息
      return await this.getUserById(id);
    } catch (error) {
      throw new Error(`更新用户失败: ${error.message}`);
    }
  }

  // 更新用户密码
  static async updatePassword(id, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const sql = 'UPDATE user SET password = ? WHERE id = ?';
      await query(sql, [hashedPassword, id]);
      return true;
    } catch (error) {
      throw new Error(`更新密码失败: ${error.message}`);
    }
  }

  // 删除用户
  static async deleteUser(id) {
    try {
      // 检查用户是否存在
      const existingUser = await this.getUserById(id);
      if (!existingUser) {
        throw new Error('用户不存在');
      }

      const sql = 'DELETE FROM user WHERE id = ?';
      const result = await query(sql, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`删除用户失败: ${error.message}`);
    }
  }

  // 验证用户密码
  static async verifyPassword(email, password) {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        return null;
      }
      // 验证方式：比对哈希，验证输入密码与存储的哈希是否匹配
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid) {
        // 返回用户信息（不包含密码）
        const { password: _, ...userInfo } = user;
        return userInfo;
      }
      return null;
    } catch (error) {
      throw new Error(`密码验证失败: ${error.message}`);
    }
  }

  // ===== Refresh Token 管理方法 =====

  /**
   * 保存refresh token到数据库
   * @param {string} userId - 用户ID
   * @param {string} token - refresh token
   * @param {Date} expiresAt - 过期时间
   * @param {string} deviceInfo - 设备信息（可选）
   */
  static async saveRefreshToken(userId, token, expiresAt, deviceInfo = null) {
    try {
      console.log('💾 Saving refresh token to database...');
      console.log('User ID:', userId);
      console.log('Token (partial):', token.substring(0, 30) + '...');
      console.log('Expires at (original):', expiresAt);
      
      // 确保使用UTC时间存储
      const utcExpiresAt = new Date(expiresAt).toISOString().slice(0, 19).replace('T', ' ');
      console.log('Expires at (UTC):', utcExpiresAt);
      
      const sql = 'INSERT INTO refresh_tokens (user_id, token, expires_at, device_info) VALUES (?, ?, ?, ?)';
      const result = await query(sql, [userId, token, utcExpiresAt, deviceInfo]);
      
      console.log('✅ Refresh token saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving refresh token:', error);
      throw new Error(`保存refresh token失败: ${error.message}`);
    }
  }

  /**
   * 验证refresh token是否存在且有效
   * @param {string} token - refresh token
   * @returns {Object|null} token记录信息
   */
  static async verifyRefreshToken(token) {
    try {
      console.log('🔍 Verifying refresh token in database...');
      console.log('Token to verify:', token.substring(0, 20) + '...');
      
      // 使用UTC时间进行比较，避免时区问题
      const sql = `
        SELECT rt.*, u.id as user_id, u.name, u.email 
        FROM refresh_tokens rt 
        JOIN user u ON rt.user_id = u.id 
        WHERE rt.token = ? AND rt.expires_at > UTC_TIMESTAMP()
      `;
      
      console.log('SQL query:', sql);
      const results = await query(sql, [token]);
      console.log('Query results count:', results.length);
      
      if (results.length > 0) {
        console.log('✅ Token found in database:', {
          id: results[0].id,
          user_id: results[0].user_id,
          expires_at: results[0].expires_at
        });
      } else {
        console.log('❌ Token not found in database');
        
        // 额外检查：查看是否存在该token（不考虑过期时间），使用UTC时间比较
        const checkSql = `
          SELECT rt.*, rt.expires_at, UTC_TIMESTAMP() as current_time,
                 CASE 
                   WHEN rt.expires_at > UTC_TIMESTAMP() THEN 'valid'
                   ELSE 'expired'
                 END as token_status
          FROM refresh_tokens rt 
          WHERE rt.token = ?
        `;
        const checkResults = await query(checkSql, [token]);
        
        if (checkResults.length > 0) {
          const tokenInfo = checkResults[0];
          console.log('🔍 Token found in database:', {
            id: tokenInfo.id,
            expires_at: tokenInfo.expires_at,
            current_time: tokenInfo.current_time,
            status: tokenInfo.token_status
          });
          
          if (tokenInfo.token_status === 'expired') {
            console.log('⚠️ Token exists but expired');
          } else {
            console.log('⚠️ Token is valid but not returned by main query - possible database issue');
          }
        } else {
          console.log('❌ Token does not exist in database at all');
        }
      }
      
      return results[0] || null;
    } catch (error) {
      console.log('❌ Database error during token verification:', error.message);
      throw new Error(`验证refresh token失败: ${error.message}`);
    }
  }

  /**
   * 删除指定的refresh token
   * @param {string} token - refresh token
   */
  static async deleteRefreshToken(token) {
    try {
      const sql = 'DELETE FROM refresh_tokens WHERE token = ?';
      const result = await query(sql, [token]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`删除refresh token失败: ${error.message}`);
    }
  }

  /**
   * 删除用户的所有refresh token（用于登出所有设备）
   * @param {string} userId - 用户ID
   */
  static async deleteAllRefreshTokens(userId) {
    try {
      const sql = 'DELETE FROM refresh_tokens WHERE user_id = ?';
      const result = await query(sql, [userId]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(`删除所有refresh token失败: ${error.message}`);
    }
  }

  /**
   * 清理过期的refresh token
   */
  static async cleanExpiredRefreshTokens() {
    try {
      console.log('🧹 Cleaning expired refresh tokens...');
      
      // 使用UTC时间清理过期token
      const sql = 'DELETE FROM refresh_tokens WHERE expires_at <= UTC_TIMESTAMP()';
      const result = await query(sql);
      
      console.log(`✅ Cleaned ${result.affectedRows} expired refresh tokens`);
      return result.affectedRows;
    } catch (error) {
      console.error('❌ Error cleaning expired refresh tokens:', error);
      throw new Error(`清理过期token失败: ${error.message}`);
    }
  }

  /**
   * 获取用户的所有有效refresh token
   * @param {string} userId - 用户ID
   */
  static async getUserRefreshTokens(userId) {
    try {
      console.log('🔍 Getting user refresh tokens...');
      console.log('User ID:', userId);
      
      // 使用UTC时间查询有效token
      const sql = `
        SELECT id, token, expires_at, created_at, device_info,
               CASE 
                 WHEN expires_at > UTC_TIMESTAMP() THEN 'valid'
                 ELSE 'expired'
               END as status
        FROM refresh_tokens 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `;
      
      const results = await query(sql, [userId]);
      
      console.log(`📊 Found ${results.length} refresh tokens for user`);
      results.forEach((token, index) => {
        console.log(`Token ${index + 1}: ${token.status} (expires: ${token.expires_at})`);
      });
      
      return results;
    } catch (error) {
      console.error('❌ Error getting user refresh tokens:', error);
      throw new Error(`获取用户refresh token失败: ${error.message}`);
    }
  }
}

module.exports = UserModel;