const DailyTaskModel = require('../models/dailyTaskModel');
const { successResponse, errorResponse } = require('../utils/helpers');

class DailyTaskController {
  /**
   * 获取用户指定日期的学习任务列表
   * GET /api/tasks/daily?date=YYYY-MM-DD
   */
  static async getDailyTasks(req, res) {
    try {
      const userId = req.user.userId; // 从JWT中间件获取用户ID
      console.log('获取每日任务的用户ID:', userId);
      const { date } = req.query;
      
      // 如果没有提供日期，使用今天的日期
      const taskDate = date || new Date().toISOString().split('T')[0];
      
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      const tasks = await DailyTaskModel.getUserDailyTasks(userId, taskDate);
      const stats = await DailyTaskModel.getTaskStats(userId, taskDate);
      
      return res.json(successResponse({
        tasks,
        stats,
        date: taskDate
      }, '获取每日任务成功'));
    } catch (error) {
      console.error('获取每日任务失败:', error);
      return res.status(500).json(errorResponse('获取每日任务失败'));
    }
  }

  /**
   * 获取用户指定日期范围的学习任务
   * GET /api/tasks/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  static async getTasksInRange(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json(errorResponse('请提供开始日期和结束日期'));
      }
      
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      const tasks = await DailyTaskModel.getUserTasksInRange(userId, startDate, endDate);
      
      return res.json(successResponse({
        tasks,
        startDate,
        endDate
      }, '获取任务范围成功'));
    } catch (error) {
      console.error('获取任务范围失败:', error);
      return res.status(500).json(errorResponse('获取任务范围失败'));
    }
  }

  /**
   * 创建新的学习任务
   * POST /api/tasks/daily
   */
  static async createTask(req, res) {
    try {
      const userId = req.user.userId;
      const { title, date } = req.body;
      
      if (!title || title.trim().length === 0) {
        return res.status(400).json(errorResponse('任务标题不能为空'));
      }
      
      if (title.length > 255) {
        return res.status(400).json(errorResponse('任务标题不能超过255个字符'));
      }
      
      // 如果没有提供日期，使用今天的日期
      const taskDate = date || new Date().toISOString().split('T')[0];
      
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      const task = await DailyTaskModel.createTask(userId, title.trim(), taskDate);
      
      return res.status(201).json(successResponse(task, '创建任务成功'));
    } catch (error) {
      console.error('创建任务失败:', error);
      if (error.message === '每日最多只能设定6个学习任务') {
        return res.status(400).json(errorResponse(error.message));
      }
      return res.status(500).json(errorResponse('创建任务失败'));
    }
  }

  /**
   * 更新任务信息
   * PUT /api/tasks/daily/:taskId
   */
  static async updateTask(req, res) {
    try {
      const userId = req.user.userId;
      const { taskId } = req.params;
      const updates = req.body;
      
      if (!taskId) {
        return res.status(400).json(errorResponse('任务ID不能为空'));
      }
      
      // 验证更新字段
      const allowedFields = ['title', 'completed'];
      const hasValidField = Object.keys(updates).some(key => allowedFields.includes(key));
      
      if (!hasValidField) {
        return res.status(400).json(errorResponse('没有有效的更新字段'));
      }
      
      // 验证title字段
      if (updates.title !== undefined) {
        if (typeof updates.title !== 'string' || updates.title.trim().length === 0) {
          return res.status(400).json(errorResponse('任务标题不能为空'));
        }
        if (updates.title.length > 255) {
          return res.status(400).json(errorResponse('任务标题不能超过255个字符'));
        }
        updates.title = updates.title.trim();
      }
      
      // 验证completed字段
      if (updates.completed !== undefined) {
        if (typeof updates.completed !== 'boolean' && updates.completed !== 0 && updates.completed !== 1) {
          return res.status(400).json(errorResponse('完成状态必须是布尔值'));
        }
        updates.completed = updates.completed ? 1 : 0;
      }

      const task = await DailyTaskModel.updateTask(taskId, userId, updates);
      return res.json(successResponse(task, '更新任务成功'));
    } catch (error) {
      console.error('更新任务失败:', error);
      if (error.message === '任务不存在或无权限访问') {
        return res.status(404).json(errorResponse(error.message));
      }
      return res.status(500).json(errorResponse('更新任务失败'));
    }
  }

  /**
   * 删除任务
   * DELETE /api/tasks/daily/:taskId
   */
  static async deleteTask(req, res) {
    try {
      const userId = req.user.userId;
      const { taskId } = req.params;
      
      if (!taskId) {
        return res.status(400).json(errorResponse('任务ID不能为空'));
      }

      const success = await DailyTaskModel.deleteTask(taskId, userId);
      
      if (success) {
        return res.json(successResponse(null, '删除任务成功'));
      } else {
        return res.status(500).json(errorResponse('删除任务失败'));
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      if (error.message === '任务不存在或无权限访问') {
        return res.status(404).json(errorResponse(error.message));
      }
      return res.status(500).json(errorResponse('删除任务失败'));
    }
  }

  /**
   * 批量更新任务完成状态
   * PUT /api/tasks/daily/batch-status
   */
  static async batchUpdateTaskStatus(req, res) {
    try {
      const userId = req.user.userId;
      const { taskIds, completed } = req.body;
      
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json(errorResponse('任务ID列表不能为空'));
      }
      
      if (typeof completed !== 'boolean' && completed !== 0 && completed !== 1) {
        return res.status(400).json(errorResponse('完成状态必须是布尔值'));
      }
      
      const completedValue = completed ? 1 : 0;
      const updatedCount = await DailyTaskModel.batchUpdateTaskStatus(userId, taskIds, completedValue);
      
      return res.json(successResponse({
        updatedCount,
        totalRequested: taskIds.length
      }, '批量更新任务状态成功'));
    } catch (error) {
      console.error('批量更新任务状态失败:', error);
      return res.status(500).json(errorResponse('批量更新任务状态失败'));
    }
  }

  /**
   * 获取任务统计信息
   * GET /api/tasks/stats?date=YYYY-MM-DD
   */
  static async getTaskStats(req, res) {
    try {
      const userId = req.user.userId;
      const { date } = req.query;
      
      // 如果没有提供日期，使用今天的日期
      const taskDate = date || new Date().toISOString().split('T')[0];
      
      // 验证日期格式
      if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDate)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      const stats = await DailyTaskModel.getTaskStats(userId, taskDate);
      
      return res.json(successResponse({
        ...stats,
        date: taskDate,
        completionRate: stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(1) : 0
      }, '获取任务统计成功'));
    } catch (error) {
      console.error('获取任务统计失败:', error);
      return res.status(500).json(errorResponse('获取任务统计失败'));
    }
  }

  /**
   * 获取学习任务历史统计
   * GET /api/tasks/history?days=7
   */
  static async getTaskHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { days = 7 } = req.query;
      
      const daysNum = parseInt(days);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return res.status(400).json(errorResponse('天数必须是1-365之间的数字'));
      }

      const history = await DailyTaskModel.getTaskHistory(userId, daysNum);
      
      // 计算总体统计
      const totalStats = history.reduce((acc, day) => {
        acc.totalTasks += day.total;
        acc.totalCompleted += day.completed;
        acc.totalPending += day.pending;
        return acc;
      }, { totalTasks: 0, totalCompleted: 0, totalPending: 0 });
      
      const overallCompletionRate = totalStats.totalTasks > 0 
        ? (totalStats.totalCompleted / totalStats.totalTasks * 100).toFixed(1)
        : 0;
      
      return res.json(successResponse({
        history,
        summary: {
          ...totalStats,
          days: daysNum,
          overallCompletionRate
        }
      }, '获取任务历史成功'));
    } catch (error) {
      console.error('获取任务历史失败:', error);
      return res.status(500).json(errorResponse('获取任务历史失败'));
    }
  }

  /**
   * 批量创建某日期的任务
   * POST /api/tasks/daily/batch
   */
  static async batchCreateTasks(req, res) {
    try {
      const userId = req.user.userId;
      const { titles, date } = req.body;

      if (!Array.isArray(titles) || titles.length === 0) {
        return res.status(400).json(errorResponse('任务标题列表不能为空'));
      }

      // 验证日期
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      // 验证每个标题
      const invalidTitle = titles.find(t => typeof t !== 'string' || t.trim().length === 0 || t.trim().length > 255);
      if (invalidTitle !== undefined) {
        return res.status(400).json(errorResponse('每个任务标题必须为1-255个字符的字符串'));
      }

      // 调用模型批量创建
      const createdTasks = await DailyTaskModel.batchCreateTasks(userId, titles, date);
      return res.status(201).json(successResponse(createdTasks, '批量创建任务成功'));
    } catch (error) {
      console.error('批量创建任务失败:', error);
      if (typeof error.message === 'string' && error.message.includes('每日最多只能设定6个学习任务')) {
        return res.status(400).json(errorResponse(error.message));
      }
      return res.status(500).json(errorResponse('批量创建任务失败'));
    }
  }

  /**
   * 按日期批量更新任务状态
   * PUT /api/tasks/daily/date-status
   */
  static async batchUpdateTasksByDate(req, res) {
    try {
      const userId = req.user.userId;
      const { date, completed } = req.body;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      if (typeof completed !== 'boolean' && completed !== 0 && completed !== 1) {
        return res.status(400).json(errorResponse('完成状态必须是布尔值'));
      }

      const completedValue = completed ? 1 : 0;
      const updatedCount = await DailyTaskModel.batchUpdateTasksByDate(userId, date, completedValue);

      return res.json(successResponse({
        updatedCount,
        date,
        completed: !!completedValue
      }, '按日期批量更新任务状态成功'));
    } catch (error) {
      console.error('按日期批量更新任务状态失败:', error);
      return res.status(500).json(errorResponse('按日期批量更新任务状态失败'));
    }
  }

  /**
   * 删除某日期的所有任务
   * DELETE /api/tasks/daily?date=YYYY-MM-DD
   */
  static async deleteTasksByDate(req, res) {
    try {
      const userId = req.user.userId;
      const { date } = req.query;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }

      const deletedCount = await DailyTaskModel.deleteTasksByDate(userId, date);
      return res.json(successResponse({ deletedCount, date }, '删除指定日期的任务成功'));
    } catch (error) {
      console.error('删除指定日期的任务失败:', error);
      return res.status(500).json(errorResponse('删除指定日期的任务失败'));
    }
  }

  /**
   * 统一批量接口：按日期批量创建或批量更新
   * 规则：
   * - 若 data 中存在没有 id 的项，执行批量创建
   * - 若 data 中的项都有 id，执行批量更新
   * - data 为空则报错
   * POST /api/tasks/daily/bulk
   */
  static async bulkCreateOrUpdateByDate(req, res) {
    try {
      const userId = req.user.userId;
      const { date, data } = req.body;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json(errorResponse('日期格式不正确，请使用YYYY-MM-DD格式'));
      }
      if (!Array.isArray(data)) {
        return res.status(400).json(errorResponse('数据列表必须为数组'));
      }
      if (data.length === 0) {
        // 空数组即删除该日期所有任务
        const deletedCount = await DailyTaskModel.deleteTasksByDate(userId, date);
        return res.json(successResponse({ created: [], updated: 0, deleted: deletedCount, date }, '已清空该日期的任务'));
      }
      if (data.length > 6) {
        return res.status(400).json(errorResponse('每日最多只能设定6个学习任务'));
      }

      // 校验数据结构：有 id 的可以只更新 completed/title；无 id 的必须有合法 title
      const invalidItem = data.find(item =>
        !item || typeof item !== 'object' ||
        (item.title !== undefined && (typeof item.title !== 'string' || item.title.trim().length === 0 || item.title.trim().length > 255)) ||
        (item.completed !== undefined && typeof item.completed !== 'boolean' && item.completed !== 0 && item.completed !== 1) ||
        (!item.id && (typeof item.title !== 'string' || item.title.trim().length === 0 || item.title.trim().length > 255))
      );
      if (invalidItem !== undefined) {
        return res.status(400).json(errorResponse('数据格式不正确：无 id 的项必须提供1-255字符的 title；completed 必须为布尔值或0/1'));
      }

      // 读取该日期现有任务，校验请求里带 id 的任务必须属于该日期
      const currentTasks = await DailyTaskModel.getUserDailyTasks(userId, date);
      const currentMap = new Map(currentTasks.map(t => [t.id, t]));
      const incomingIds = new Set(data.filter(i => !!i.id).map(i => i.id));

      const invalidIds = [...incomingIds].filter(id => !currentMap.has(id));
      if (invalidIds.length > 0) {
        return res.status(400).json(errorResponse(`存在不属于该日期的任务ID: ${invalidIds.join(', ')}`));
      }

      // 计算需要删除的任务：现有集合 - 请求集合
      const toDeleteIds = currentTasks
        .map(t => t.id)
        .filter(id => !incomingIds.has(id));

      // 先更新请求中带 id 的任务
      let updatedCount = 0;
      const updateItems = data.filter(i => !!i.id);
      if (updateItems.length > 0) {
        const updatePromises = updateItems.map(async (item) => {
          const updates = {};
          if (item.title !== undefined) updates.title = item.title.trim();
          if (item.completed !== undefined) updates.completed = item.completed ? 1 : 0;

          if (Object.keys(updates).length === 0) return null;
          await DailyTaskModel.updateTask(item.id, userId, updates);
          return true;
        });
        const updateResults = await Promise.all(updatePromises);
        updatedCount = updateResults.filter(Boolean).length;
      }

      // 再删除不在请求里的旧任务
      let deletedCount = 0;
      if (toDeleteIds.length > 0) {
        const deletePromises = toDeleteIds.map(id => DailyTaskModel.deleteTask(id, userId).then(ok => ok ? 1 : 0));
        const deleteResults = await Promise.all(deletePromises);
        deletedCount = deleteResults.reduce((a, b) => a + b, 0);
      }

      // 最后创建没有 id 的新任务（批量）
      let createdTasks = [];
      const createItems = data.filter(i => !i.id);
      if (createItems.length > 0) {
        const titles = createItems.map(i => i.title.trim());
        createdTasks = await DailyTaskModel.batchCreateTasks(userId, titles, date);
      }

      const results = {
        created: createdTasks,
        updated: updatedCount,
        deleted: deletedCount,
        date
      };
      return res.json(successResponse(results, '已全量替换指定日期的任务'));
    } catch (error) {
      console.error('统一批量接口失败:', error);
      if (typeof error.message === 'string' && error.message.includes('每日最多只能设定6个学习任务')) {
        return res.status(400).json(errorResponse(error.message));
      }
      if (typeof error.message === 'string' && error.message.includes('任务不存在或无权限访问')) {
        return res.status(404).json(errorResponse(error.message));
      }
      return res.status(500).json(errorResponse('批量操作失败'));
    }
  }
}

module.exports = DailyTaskController;