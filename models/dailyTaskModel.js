const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DailyTaskModel {
  /**
   * 获取用户指定日期的学习任务列表
   * @param {string} userId - 用户ID
   * @param {string} taskDate - 任务日期 (YYYY-MM-DD)
   * @returns {Promise<Array>} 任务列表
   */
  static async getUserDailyTasks(userId, taskDate) {
    const sql = `
      SELECT id, title, completed, task_date, created_at, updated_at
      FROM daily_tasks 
      WHERE user_id = ? AND task_date = ?
      ORDER BY created_at ASC
    `;
    const results = await query(sql, [userId, taskDate]);
    console.log('获取用户指定日期的学习任务列表:', results);
    return results;
  }

  /**
   * 获取用户指定日期范围的学习任务
   * @param {string} userId - 用户ID
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Promise<Array>} 任务列表
   */
  static async getUserTasksInRange(userId, startDate, endDate) {
    const sql = `
      SELECT id, title, completed, task_date, created_at, updated_at
      FROM daily_tasks 
      WHERE user_id = ? AND task_date BETWEEN ? AND ?
      ORDER BY task_date DESC, created_at ASC
    `;
    return await query(sql, [userId, startDate, endDate]);
  }

  /**
   * 创建新的学习任务
   * @param {string} userId - 用户ID
   * @param {string} title - 任务标题
   * @param {string} taskDate - 任务日期
   * @returns {Promise<Object>} 创建的任务信息
   */
  static async createTask(userId, title, taskDate) {
    // 首先检查该用户当天的任务数量
    const countSql = `
      SELECT COUNT(*) as count 
      FROM daily_tasks 
      WHERE user_id = ? AND task_date = ?
    `;
    const countResult = await query(countSql, [userId, taskDate]);
    
    if (countResult[0].count >= 6) {
      throw new Error('每日最多只能设定6个学习任务');
    }

    const taskId = uuidv4();
    const sql = `
      INSERT INTO daily_tasks (id, user_id, title, completed, task_date)
      VALUES (?, ?, ?, 0, ?)
    `;
    
    await query(sql, [taskId, userId, title, taskDate]);
    
    // 返回创建的任务信息
    return await this.getTaskById(taskId);
  }

  /**
   * 根据ID获取任务
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object|null>} 任务信息
   */
  static async getTaskById(taskId) {
    const sql = `
      SELECT id, user_id, title, completed, task_date, created_at, updated_at
      FROM daily_tasks 
      WHERE id = ?
    `;
    const result = await query(sql, [taskId]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * 更新任务信息
   * @param {string} taskId - 任务ID
   * @param {string} userId - 用户ID（用于权限验证）
   * @param {Object} updates - 更新的字段
   * @returns {Promise<Object>} 更新后的任务信息
   */
  static async updateTask(taskId, userId, updates) {
    // 验证任务是否属于该用户
    const task = await this.getTaskById(taskId);
    if (!task || task.user_id !== userId) {
      throw new Error('任务不存在或无权限访问');
    }

    const allowedFields = ['title', 'completed'];
    const updateFields = [];
    const updateValues = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('没有有效的更新字段');
    }

    updateValues.push(taskId);
    const sql = `
      UPDATE daily_tasks 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;
    
    await query(sql, updateValues);
    const result = await this.getTaskById(taskId);
    return result;
  }

  /**
   * 删除任务
   * @param {string} taskId - 任务ID
   * @param {string} userId - 用户ID（用于权限验证）
   * @returns {Promise<boolean>} 删除是否成功
   */
  static async deleteTask(taskId, userId) {
    // 验证任务是否属于该用户
    const task = await this.getTaskById(taskId);
    if (!task || task.user_id !== userId) {
      throw new Error('任务不存在或无权限访问');
    }

    const sql = 'DELETE FROM daily_tasks WHERE id = ?';
    const result = await query(sql, [taskId]);
    return result.affectedRows > 0;
  }

  /**
   * 批量更新任务完成状态
   * @param {string} userId - 用户ID
   * @param {Array} taskIds - 任务ID数组
   * @param {boolean} completed - 完成状态
   * @returns {Promise<number>} 更新的任务数量
   */
  static async batchUpdateTaskStatus(userId, taskIds, completed) {
    if (!taskIds || taskIds.length === 0) {
      return 0;
    }

    const placeholders = taskIds.map(() => '?').join(',');
    const sql = `
      UPDATE daily_tasks 
      SET completed = ?, updated_at = NOW()
      WHERE user_id = ? AND id IN (${placeholders})
    `;
    
    const params = [completed, userId, ...taskIds];
    const result = await query(sql, params);
    return result.affectedRows;
  }

  /**
   * 获取用户的任务统计信息
   * @param {string} userId - 用户ID
   * @param {string} taskDate - 任务日期
   * @returns {Promise<Object>} 统计信息
   */
  static async getTaskStats(userId, taskDate) {
    const sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
      FROM daily_tasks 
      WHERE user_id = ? AND task_date = ?
    `;
    const result = await query(sql, [userId, taskDate]);
    return result[0] || { total: 0, completed: 0, pending: 0 };
  }

  /**
   * 批量创建某日期的任务
   * @param {string} userId - 用户ID
   * @param {Array} taskTitles - 任务标题数组
   * @param {string} taskDate - 任务日期
   * @returns {Promise<Array>} 创建的任务列表
   */
  static async batchCreateTasks(userId, taskTitles, taskDate) {
    // 检查当前日期已有的任务数量
    const countSql = `
      SELECT COUNT(*) as count 
      FROM daily_tasks 
      WHERE user_id = ? AND task_date = ?
    `;
    const countResult = await query(countSql, [userId, taskDate]);
    const currentTaskCount = countResult[0].count;
    
    // 检查新增任务后是否会超过限制
    if (currentTaskCount + taskTitles.length > 6) {
      throw new Error(`每日最多只能设定6个学习任务，当前已有${currentTaskCount}个任务，最多还能添加${6 - currentTaskCount}个任务`);
    }

    // 批量插入任务
    const tasks = [];
    const insertPromises = taskTitles.map(async (title) => {
      const taskId = uuidv4();
      const sql = `
        INSERT INTO daily_tasks (id, user_id, title, completed, task_date)
        VALUES (?, ?, ?, 0, ?)
      `;
      await query(sql, [taskId, userId, title.trim(), taskDate]);
      
      // 获取创建的任务信息
      const task = await this.getTaskById(taskId);
      tasks.push(task);
      return task;
    });
    
    await Promise.all(insertPromises);
    return tasks;
  }

  /**
   * 按日期批量更新任务状态
   * @param {string} userId - 用户ID
   * @param {string} taskDate - 任务日期
   * @param {boolean} completed - 完成状态
   * @returns {Promise<number>} 更新的任务数量
   */
  static async batchUpdateTasksByDate(userId, taskDate, completed) {
    const sql = `
      UPDATE daily_tasks 
      SET completed = ?, updated_at = NOW()
      WHERE user_id = ? AND task_date = ?
    `;
    
    const result = await query(sql, [completed, userId, taskDate]);
    return result.affectedRows;
  }

  /**
   * 删除某日期的所有任务
   * @param {string} userId - 用户ID
   * @param {string} taskDate - 任务日期
   * @returns {Promise<number>} 删除的任务数量
   */
  static async deleteTasksByDate(userId, taskDate) {
    const sql = 'DELETE FROM daily_tasks WHERE user_id = ? AND task_date = ?';
    const result = await query(sql, [userId, taskDate]);
    return result.affectedRows;
  }

  /**
   * 获取某日期的任务数量（用于验证6个任务限制）
   * @param {string} userId - 用户ID
   * @param {string} taskDate - 任务日期
   * @returns {Promise<number>} 任务数量
   */
  static async getTaskCountByDate(userId, taskDate) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM daily_tasks 
      WHERE user_id = ? AND task_date = ?
    `;
    const result = await query(sql, [userId, taskDate]);
    return result[0].count;
  }

  /**
   * 获取用户的学习任务历史统计
   * @param {string} userId - 用户ID
   * @param {number} days - 统计天数（默认7天）
   * @returns {Promise<Array>} 历史统计数据
   */
  static async getTaskHistory(userId, days = 7) {
    const sql = `
      SELECT 
        task_date,
        COUNT(*) as total,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending
      FROM daily_tasks 
      WHERE user_id = ? AND task_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY task_date
      ORDER BY task_date DESC
    `;
    return await query(sql, [userId, days]);
  }
}

module.exports = DailyTaskModel;