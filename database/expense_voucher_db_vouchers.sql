-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: expense_voucher_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `vouchers`
--

DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vouchers` (
  `voucher_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `voucher_number` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employee_user_id` bigint unsigned NOT NULL,
  `employee_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `employee_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `voucher_date` date NOT NULL,
  `expense_date` date NOT NULL,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `amount` decimal(12,2) NOT NULL,
  `employee_signature_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `director_signature_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Draft','Pending Approval','Approved','Rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Draft',
  `submitted_at` datetime DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_by` bigint unsigned DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`voucher_id`),
  UNIQUE KEY `voucher_number` (`voucher_number`),
  KEY `fk_voucher_approver` (`approved_by`),
  KEY `fk_voucher_rejector` (`rejected_by`),
  KEY `idx_voucher_employee` (`employee_user_id`),
  KEY `idx_voucher_status` (`status`),
  KEY `idx_voucher_department` (`department`),
  KEY `idx_voucher_category` (`category`),
  KEY `idx_voucher_expense_date` (`expense_date`),
  KEY `idx_voucher_amount` (`amount`),
  KEY `idx_voucher_created_at` (`created_at`),
  CONSTRAINT `fk_voucher_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_voucher_employee` FOREIGN KEY (`employee_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `fk_voucher_rejector` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `chk_voucher_amount` CHECK ((`amount` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vouchers`
--

LOCK TABLES `vouchers` WRITE;
/*!40000 ALTER TABLE `vouchers` DISABLE KEYS */;
INSERT INTO `vouchers` VALUES (1,'VCH-2026-000001',1,'Test Employee','EMP001','2026-10-10','2026-10-09','Finance','Office Stationery - Updated','Office Supplies','Purchased notebooks, pens, and files',1500.00,'uploads/signature-1-1791648235463.jpg','uploads/signature-2-1791655814124.jpg','Approved','2026-10-10 21:38:22',2,'2026-10-10 23:42:06',NULL,NULL,NULL,'2026-10-10 15:24:56','2026-10-10 18:12:06'),(3,'VCH-2026-000002',1,'Test Employee','EMP001','2026-10-10','2026-10-10','Finance','Office Travel Expenses','Travel','Local travel expenses for official work.',850.00,'uploads/test-employee-signature.jpg',NULL,'Rejected','2026-10-10 23:48:39',NULL,NULL,2,'2026-10-10 23:50:29','Please provide a valid expense receipt.','2026-10-10 18:18:39','2026-10-10 18:20:29'),(5,'VCH-2026-000005',1,'Test Employee','EMP001','2026-10-11','2026-10-09','Finance','Office Stationery Purchase','Office Supplies','Office use',1250.00,'uploads/signature-1-1791700586280.jpg','uploads/signature-2-1791700696083.jpg','Approved','2026-10-11 12:06:40',2,'2026-10-11 12:14:40',NULL,NULL,NULL,'2026-10-11 06:36:09','2026-10-11 06:44:40'),(6,'VCH-2026-000006',1,'Test Employee','EMP001','2026-10-11','2026-10-10','Finance','Internet Bill – October 2026','Communication','Monthly internet bill for office-related work and online meetings.',1500.00,NULL,NULL,'Draft',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-11 07:03:58','2026-10-11 07:03:58'),(7,'VCH-2026-000007',4,'Demo Employee','EMP002','2026-10-11','2026-10-10','Finance','Internet Bill- Oct 2026','Communication','Monthly internet bill for office-related work and online meetings.',1500.00,'uploads/signature-4-1791704179187.jpg','uploads/signature-2-1791704917829.jpg','Approved','2026-10-11 13:11:29',2,'2026-10-11 13:26:34',NULL,NULL,NULL,'2026-10-11 07:07:06','2026-10-11 07:56:34'),(8,'VCH-2026-000008',1,'Test Employee','EMP001','2026-10-11','2026-10-10','Finance','Validation Test Voucher','Office Supplies','Testing a valid voucher request.',500.00,NULL,NULL,'Draft',NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-11 08:14:14','2026-10-11 08:14:14'),(9,'VCH-2026-000009',1,'Test Employee','EMP001','2026-10-10','2026-10-09','Finance','Valid Test Date','Office Supplies','Testing valid date validation',500.00,'uploads/signature-1-1791727413324.jpg',NULL,'Pending Approval','2026-10-11 19:33:40',NULL,NULL,NULL,NULL,NULL,'2026-10-11 08:20:29','2026-10-11 14:03:40'),(10,'VCH-2026-000010',1,'Test Employee','EMP001','2026-10-11','2026-10-10','Finance','Office Stationery Purchase','Office Supplies','Purchased notebooks, pens, printer paper and other stationery items for office use.',1250.00,'uploads/signature-1-1791709433187.jpg','uploads/signature-2-1791709566886.jpg','Approved','2026-10-11 14:34:00',2,'2026-10-11 14:36:16',NULL,NULL,NULL,'2026-10-11 09:02:26','2026-10-11 09:06:16');
/*!40000 ALTER TABLE `vouchers` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-11 21:13:59
