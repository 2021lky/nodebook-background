const bcrypt = require('bcrypt');

/**
 * 密码工具类
 * 提供统一的密码加密、验证和安全管理功能
 */
class PasswordUtils {
  // 盐值轮数配置
  static SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

  /**
   * 加密密码
   * @param {string} plainPassword - 明文密码
   * @returns {Promise<string>} 加密后的密码哈希
   */
  static async hashPassword(plainPassword) {
    try {
      if (!plainPassword || typeof plainPassword !== 'string') {
        throw new Error('密码必须是非空字符串');
      }

      // 密码强度基本检查
      if (plainPassword.length < 6) {
        throw new Error('密码长度至少为6位');
      }

      return await bcrypt.hash(plainPassword, this.SALT_ROUNDS);
    } catch (error) {
      throw new Error(`密码加密失败: ${error.message}`);
    }
  }

  /**
   * 验证密码
   * @param {string} plainPassword - 明文密码
   * @param {string} hashedPassword - 数据库中的密码哈希
   * @returns {Promise<boolean>} 验证结果
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      if (!plainPassword || !hashedPassword) {
        return false;
      }

      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new Error(`密码验证失败: ${error.message}`);
    }
  }

  /**
   * 检查密码强度
   * @param {string} password - 密码
   * @returns {Object} 强度检查结果
   */
  static checkPasswordStrength(password) {
    const result = {
      isValid: false,
      score: 0,
      feedback: []
    };

    if (!password) {
      result.feedback.push('密码不能为空');
      return result;
    }

    // 长度检查
    if (password.length < 6) {
      result.feedback.push('密码长度至少为6位');
    } else if (password.length >= 8) {
      result.score += 1;
    }

    // 复杂度检查
    if (/[a-z]/.test(password)) result.score += 1; // 小写字母
    if (/[A-Z]/.test(password)) result.score += 1; // 大写字母
    if (/\d/.test(password)) result.score += 1;    // 数字
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) result.score += 1; // 特殊字符

    // 评估强度
    if (result.score >= 3 && password.length >= 6) {
      result.isValid = true;
    }

    if (result.score < 2) {
      result.feedback.push('建议使用字母、数字和特殊字符的组合');
    }

    return result;
  }

  /**
   * 生成随机密码
   * @param {number} length - 密码长度
   * @returns {string} 随机密码
   */
  static generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }
}

module.exports = PasswordUtils;