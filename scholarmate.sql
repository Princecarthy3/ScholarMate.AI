-- SCHOLARMATE AI - MYSQL & SQLITE DATABASE SCHEMA
-- Target Database: scholarmate
-- Auto-executed by api/db.php or import manually via phpMyAdmin / MySQL CLI

CREATE DATABASE IF NOT EXISTS `scholarmate` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `scholarmate`;

-- Table 1: Users Profile & Telemetry
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `streak` INT DEFAULT 0,
  `last_active` VARCHAR(100) DEFAULT NULL,
  `quizzes_taken` INT DEFAULT 0,
  `questions_answered` INT DEFAULT 0,
  `correct_answers` INT DEFAULT 0,
  `study_minutes` INT DEFAULT 0,
  `mastery` LONGTEXT DEFAULT NULL,
  `picture` LONGTEXT DEFAULT NULL,
  `settings` LONGTEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: Uploaded Study Materials
CREATE TABLE IF NOT EXISTS `materials` (
  `id` VARCHAR(100) PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `size` VARCHAR(50) DEFAULT '1.0 MB',
  `content` LONGTEXT,
  `subject` VARCHAR(255) DEFAULT 'General',
  `folder` VARCHAR(255) DEFAULT 'Default',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: Quiz History & Detailed Review Breakdown
CREATE TABLE IF NOT EXISTS `quiz_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `score` VARCHAR(50) NOT NULL,
  `question_count` INT DEFAULT 0,
  `quiz_type` VARCHAR(50) DEFAULT 'Quiz',
  `review_data` LONGTEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: User Badges & Achievements Telemetry
CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `badge_key` VARCHAR(100) NOT NULL,
  `unlocked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `user_badge_unique` (`user_email`, `badge_key`),
  FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: User AI Chat Conversations
CREATE TABLE IF NOT EXISTS `user_chats` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `attached_file` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: User Notes & AI Study Guides
CREATE TABLE IF NOT EXISTS `user_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_email` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

