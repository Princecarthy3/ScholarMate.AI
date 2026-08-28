<?php
// SCHOLARMATE AI - RESPONSIVE HYBRID MYSQL / SQLITE DATABASE CONNECTOR
// Provides auto-configuring, fault-tolerant persistence with zero setup required.

$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'scholarmate';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : '';

$pdo = null;
$dbDriver = 'none';

// Attempt 1: Connect to MySQL Database (support multi-credential fallback)
$passCandidates = array_unique([$dbPass, '', 'root', '123456', 'admin', 'password']);
$hostCandidates = [$dbHost, 'localhost', '127.0.0.1'];

foreach ($hostCandidates as $h) {
    foreach ($passCandidates as $p) {
        try {
            $dsn = "mysql:host=$h;port=$dbPort;charset=utf8mb4";
            $tmpPdo = new PDO($dsn, $dbUser, $p, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 2
            ]);

            // Ensure database exists
            $tmpPdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
            $tmpPdo->exec("USE `$dbName`");

            $pdo = $tmpPdo;
            $dbDriver = 'mysql';
            break 2;
        } catch (Exception $e) {
            // Keep trying next candidate
        }
    }
}

// Attempt 2: Fallback to Embedded SQLite Database if MySQL is offline/inaccessible
if (!$pdo) {
    try {
        $sqlitePath = __DIR__ . '/scholarmate.sqlite';
        $pdo = new PDO("sqlite:" . $sqlitePath, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        $dbDriver = 'sqlite';
    } catch (Exception $e) {
        error_log("ScholarMate DB Emergency Fallback Failed: " . $e->getMessage());
        $pdo = null;
        $dbDriver = 'none';
    }
}

// Auto-provision schema and ensure all tables & columns exist dynamically
if ($pdo) {
    try {
        if ($dbDriver === 'mysql') {
            // MySQL Schema Provisioning
            $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
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
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `materials` (
                `id` VARCHAR(100) PRIMARY KEY,
                `user_email` VARCHAR(255) NOT NULL,
                `name` VARCHAR(255) NOT NULL,
                `size` VARCHAR(50) DEFAULT '1.0 MB',
                `content` LONGTEXT,
                `subject` VARCHAR(255) DEFAULT 'General',
                `folder` VARCHAR(255) DEFAULT 'Default',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `quiz_history` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_email` VARCHAR(255) NOT NULL,
                `title` VARCHAR(255) NOT NULL,
                `score` VARCHAR(50) NOT NULL,
                `question_count` INT DEFAULT 0,
                `quiz_type` VARCHAR(50) DEFAULT 'Quiz',
                `review_data` LONGTEXT,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `user_badges` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_email` VARCHAR(255) NOT NULL,
                `badge_key` VARCHAR(100) NOT NULL,
                `unlocked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY `user_badge_unique` (`user_email`, `badge_key`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `user_chats` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_email` VARCHAR(255) NOT NULL,
                `role` VARCHAR(20) NOT NULL,
                `message` LONGTEXT NOT NULL,
                `attached_file` VARCHAR(255) DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $pdo->exec("CREATE TABLE IF NOT EXISTS `user_notes` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `user_email` VARCHAR(255) NOT NULL,
                `title` VARCHAR(255) NOT NULL,
                `content` LONGTEXT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Auto-Migration for pre-existing MySQL tables with missing columns
            $columnsToEnsure = [
                'users' => [
                    'mastery' => 'LONGTEXT DEFAULT NULL',
                    'picture' => 'LONGTEXT DEFAULT NULL',
                    'settings' => 'LONGTEXT DEFAULT NULL',
                    'last_active' => 'VARCHAR(100) DEFAULT NULL'
                ],
                'quiz_history' => [
                    'review_data' => 'LONGTEXT DEFAULT NULL'
                ]
            ];

            foreach ($columnsToEnsure as $table => $cols) {
                $stmt = $pdo->query("SHOW COLUMNS FROM `$table`");
                $existingCols = $stmt->fetchAll(PDO::FETCH_COLUMN);
                foreach ($cols as $colName => $colDef) {
                    if (!in_array($colName, $existingCols)) {
                        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$colName` $colDef");
                    }
                }
            }

        } else if ($dbDriver === 'sqlite') {
            // SQLite Schema Provisioning
            $pdo->exec("CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                password TEXT DEFAULT NULL,
                streak INTEGER DEFAULT 0,
                last_active TEXT DEFAULT NULL,
                quizzes_taken INTEGER DEFAULT 0,
                questions_answered INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0,
                study_minutes INTEGER DEFAULT 0,
                mastery TEXT DEFAULT NULL,
                picture TEXT DEFAULT NULL,
                settings TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS materials (
                id TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                name TEXT NOT NULL,
                size TEXT DEFAULT '1.0 MB',
                content TEXT,
                subject TEXT DEFAULT 'General',
                folder TEXT DEFAULT 'Default',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS quiz_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                title TEXT NOT NULL,
                score TEXT NOT NULL,
                question_count INTEGER DEFAULT 0,
                quiz_type TEXT DEFAULT 'Quiz',
                review_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS user_badges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                badge_key TEXT NOT NULL,
                unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_email, badge_key)
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS user_chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                attached_file TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");

            $pdo->exec("CREATE TABLE IF NOT EXISTS user_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
        }
    } catch (Exception $e) {
        error_log("ScholarMate DB Table Provision Warning: " . $e->getMessage());
    }
}
?>
