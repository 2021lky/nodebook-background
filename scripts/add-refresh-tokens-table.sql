-- 添加refresh_tokens表的迁移脚本
-- 执行前请确保已连接到正确的数据库

USE `notebook`;

-- 创建refresh token表
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `token` varchar(500) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `device_info` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  KEY `expires_at` (`expires_at`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS `idx_user_id_expires` ON `refresh_tokens` (`user_id`, `expires_at`);

-- 添加清理过期token的存储过程
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CleanExpiredRefreshTokens()
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    SELECT ROW_COUNT() as deleted_count;
END //
DELIMITER ;

-- 创建定时清理事件（可选，需要开启事件调度器）
-- 取消注释以下代码来启用自动清理
/*
SET GLOBAL event_scheduler = ON;
CREATE EVENT IF NOT EXISTS clean_expired_tokens
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
  CALL CleanExpiredRefreshTokens();
*/

COMMIT;