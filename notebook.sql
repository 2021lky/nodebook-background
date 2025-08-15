-- MySQL dump 10.13  Distrib 5.7.24, for osx11.1 (x86_64)
--
-- Host: localhost    Database: notebook
-- ------------------------------------------------------
-- Server version	8.4.6

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `daily_tasks`
--

DROP TABLE IF EXISTS `daily_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `daily_tasks` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `title` varchar(255) NOT NULL,
  `completed` tinyint(1) DEFAULT '0',
  `task_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_task_date` (`task_date`),
  KEY `idx_user_date` (`user_id`,`task_date`),
  KEY `idx_completed` (`completed`),
  CONSTRAINT `daily_tasks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_tasks`
--

LOCK TABLES `daily_tasks` WRITE;
/*!40000 ALTER TABLE `daily_tasks` DISABLE KEYS */;
INSERT INTO `daily_tasks` VALUES ('50521cfc-6d4f-4e4e-9e1f-ec119f1901b6','b5826748-85c2-4c4a-a64c-79309907f3da','React学习',0,'2025-08-15','2025-08-15 07:04:31','2025-08-15 07:04:51'),('57f12cd1-d916-4159-9226-3382ecdc9c18','eb4b56a0-9021-4273-a097-3f119b51ba6a','力扣刷题',1,'2025-08-15','2025-08-15 12:00:20','2025-08-15 12:04:00'),('590a8e36-95e4-4efa-a4e1-21166478bb54','eb4b56a0-9021-4273-a097-3f119b51ba6a','vue学习',0,'2025-08-15','2025-08-15 12:00:20','2025-08-15 12:00:20');
/*!40000 ALTER TABLE `daily_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `file_nodes`
--

DROP TABLE IF EXISTS `file_nodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `file_nodes` (
  `id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `parent_id` char(36) DEFAULT NULL,
  `name` char(255) NOT NULL,
  `type` enum('file','folder') NOT NULL,
  `path` varchar(768) NOT NULL,
  `size` bigint DEFAULT '0',
  `mime_type` char(100) DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `storage_type` enum('database','filesystem') DEFAULT 'filesystem',
  `file_path` varchar(500) DEFAULT NULL,
  `file_hash` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_path` (`path`),
  KEY `idx_user_parent` (`user_id`,`parent_id`),
  KEY `idx_deleted` (`is_deleted`),
  CONSTRAINT `file_nodes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `file_nodes_ibfk_2` FOREIGN KEY (`parent_id`) REFERENCES `file_nodes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` char(36) NOT NULL,
  `token` varchar(500) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `device_info` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  KEY `expires_at` (`expires_at`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=439 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user` (
  `id` char(36) NOT NULL COMMENT '用户ID（UUID，36位字符串）',
  `name` varchar(50) NOT NULL COMMENT '用户名',
  `email` varchar(100) NOT NULL COMMENT '邮箱（唯一）',
  `password` varchar(255) NOT NULL COMMENT '加密后的密码',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表（UUID主键）';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES ('eb4b56a0-9021-4273-a097-3f119b51ba6a','admin','admin@qq.com','$2b$10$DFXRDqY8gm2DrXQvDi94c.XeIMBc/YSQE5rdTtOtkurXu0lOrR7sy','2025-08-15 03:56:07');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-08-15 20:11:52
