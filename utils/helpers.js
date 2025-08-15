// 工具函数集合

/**
 * 格式化响应数据
 * @param {string} status - 状态 ('success' | 'error')
 * @param {string} message - 消息
 * @param {any} data - 数据
 * @param {any} meta - 元数据
 * @returns {object} 格式化的响应对象
 */
const formatResponse = (status, message, data = null, meta = null) => {
  const response = {
    status,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (meta !== null) {
    response.meta = meta;
  }
  
  return response;
};

/**
 * 成功响应
 * @param {any} data - 数据
 * @param {string} message - 成功消息
 * @param {any} meta - 元数据
 * @returns {object} 成功响应对象
 */
const successResponse = (data = null, message = '操作成功', meta = null) => {
  return formatResponse('success', message, data, meta);
};

/**
 * 错误响应
 * @param {string} message - 错误消息
 * @param {string|any} code - 错误代码或错误详情
 * @returns {object} 错误响应对象
 */
const errorResponse = (message, code = null) => {
  let meta = null;
  
  if (code) {
    if (typeof code === 'string') {
      // 如果是字符串，作为错误代码
      meta = { code };
    } else {
      // 否则作为错误详情
      meta = { error: code };
    }
  }
  
  return formatResponse('error', message, null, meta);
};

/**
 * 分页计算
 * @param {number} page - 当前页码
 * @param {number} limit - 每页数量
 * @param {number} total - 总数量
 * @returns {object} 分页信息
 */
const calculatePagination = (page, limit, total) => {
  const currentPage = parseInt(page) || 1;
  const pageSize = parseInt(limit) || 10;
  const totalItems = parseInt(total) || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (currentPage - 1) * pageSize;
  
  return {
    current: currentPage,
    limit: pageSize,
    total: totalItems,
    pages: totalPages,
    offset,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1
  };
};

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否有效
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise对象
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
};

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @param {string} format - 格式字符串
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

module.exports = {
  formatResponse,
  successResponse,
  errorResponse,
  calculatePagination,
  isValidEmail,
  generateRandomString,
  delay,
  deepClone,
  formatDate
};