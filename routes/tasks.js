const express = require('express');
const router = express.Router();
const DailyTaskController = require('../controllers/dailyTaskController');
const { jwtAuth } = require('../middleware/auth');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

// 所有路由都需要身份验证
router.use(jwtAuth);

// 获取用户指定日期的学习任务列表
// GET /api/tasks/daily?date=YYYY-MM-DD
router.get('/daily', 
  [
    query('date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('日期格式不正确，请使用YYYY-MM-DD格式')
  ],
  handleValidationErrors,
  DailyTaskController.getDailyTasks
);

// 获取用户指定日期范围的学习任务
// GET /api/tasks/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/range',
  [
    query('startDate')
      .notEmpty()
      .withMessage('开始日期不能为空')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('开始日期格式不正确，请使用YYYY-MM-DD格式'),
    query('endDate')
      .notEmpty()
      .withMessage('结束日期不能为空')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('结束日期格式不正确，请使用YYYY-MM-DD格式')
  ],
  handleValidationErrors,
  DailyTaskController.getTasksInRange
);

// 创建新的学习任务
// POST /api/tasks/daily
router.post('/daily',
  [
    body('title')
      .notEmpty()
      .withMessage('任务标题不能为空')
      .isLength({ min: 1, max: 255 })
      .withMessage('任务标题长度必须在1-255个字符之间')
      .trim(),
    body('date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('日期格式不正确，请使用YYYY-MM-DD格式')
  ],
  handleValidationErrors,
  DailyTaskController.createTask
);

// 更新任务信息
// PUT /api/tasks/daily/:taskId
router.put('/daily/:taskId',
  [
    param('taskId')
      .notEmpty()
      .withMessage('任务ID不能为空'),
    body('title')
      .optional()
      .isLength({ min: 1, max: 255 })
      .withMessage('任务标题长度必须在1-255个字符之间')
      .trim(),
    body('completed')
      .optional()
      .custom(v => typeof v === 'boolean' || v === 0 || v === 1)
      .withMessage('完成状态必须是布尔值或数值0/1')
  ],
  handleValidationErrors,
  DailyTaskController.updateTask
);

// 删除任务
// DELETE /api/tasks/daily/:taskId
router.delete('/daily/:taskId',
  [
    param('taskId')
      .notEmpty()
      .withMessage('任务ID不能为空')
  ],
  handleValidationErrors,
  DailyTaskController.deleteTask
);

// 批量更新任务完成状态
// PUT /api/tasks/daily/batch-status
router.put('/daily/batch-status',
  [
    body('taskIds')
      .isArray({ min: 1 })
      .withMessage('任务ID列表不能为空')
      .custom((taskIds) => {
        // 验证每个taskId都是有效的UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return taskIds.every(id => uuidRegex.test(id));
      })
      .withMessage('任务ID格式不正确'),
    body('completed')
      .isBoolean()
      .withMessage('完成状态必须是布尔值')
  ],
  handleValidationErrors,
  DailyTaskController.batchUpdateTaskStatus
);


// 统一批量接口：按日期批量创建或批量更新
// POST /api/tasks/daily/bulk
router.post('/daily/bulk',
  [
    body('date')
      .notEmpty()
      .withMessage('日期不能为空')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('日期格式不正确，请使用YYYY-MM-DD格式'),
    body('data')
      .isArray({ min: 1 })
      .withMessage('数据列表不能为空'),
    body('data.*.id')
      .optional()
      .isString()
      .withMessage('id 必须为字符串'),
    body('data.*.title')
      .optional()
      .isString()
      .isLength({ min: 1, max: 255 })
      .withMessage('title 必须为1-255个字符的字符串')
      .trim(),
    body('data.*.completed')
      .optional()
      .custom(v => typeof v === 'boolean' || v === 0 || v === 1)
      .withMessage('completed 必须是布尔值或数值0/1')
  ],
  handleValidationErrors,
  DailyTaskController.bulkCreateOrUpdateByDate
);

// 删除某日期的所有任务
// DELETE /api/tasks/daily?date=YYYY-MM-DD
router.delete('/daily',
  [
    query('date')
      .notEmpty()
      .withMessage('日期不能为空')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('日期格式不正确，请使用YYYY-MM-DD格式')
  ],
  handleValidationErrors,
  DailyTaskController.deleteTasksByDate
);

// 获取任务统计信息
// GET /api/tasks/stats?date=YYYY-MM-DD
router.get('/stats',
  [
    query('date')
      .optional()
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('日期格式不正确，请使用YYYY-MM-DD格式')
  ],
  handleValidationErrors,
  DailyTaskController.getTaskStats
);

// 获取学习任务历史统计
// GET /api/tasks/history?days=7
router.get('/history',
  [
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('天数必须是1-365之间的整数')
  ],
  handleValidationErrors,
  DailyTaskController.getTaskHistory
);

module.exports = router;