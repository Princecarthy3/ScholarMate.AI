<?php
// SCHOLARMATE AI - FULL DATABASE SYNCHRONIZATION API
// Supports MySQL and SQLite backends with full multi-table user telemetry persistence

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db.php';

if (!$pdo) {
    echo json_encode(["status" => "error", "message" => "Database connector unavailable."]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// ==========================================
// GET ENDPOINT: Fetch Complete User Data
// ==========================================
if ($method === 'GET') {
    $email = trim($_GET['email'] ?? '');
    if (empty($email)) {
        http_response_code(400);
        echo json_encode(["error" => "Email required."]);
        exit();
    }

    try {
        // 1. Fetch Profile & Telemetry
        $stmt = $pdo->prepare("SELECT * FROM `users` WHERE `email` = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            echo json_encode(["status" => "not_found"]);
            exit();
        }

        // Decode JSON fields safely
        $mastery = !empty($user['mastery']) ? json_decode($user['mastery'], true) : new stdClass();
        $settings = !empty($user['settings']) ? json_decode($user['settings'], true) : new stdClass();

        // 2. Fetch User Materials
        $materials = [];
        try {
            $stmtMat = $pdo->prepare("SELECT `id`, `name`, `size`, `content`, `subject`, `folder`, `created_at` FROM `materials` WHERE `user_email` = ? ORDER BY `created_at` DESC");
            $stmtMat->execute([$email]);
            $materials = $stmtMat->fetchAll() ?: [];
        } catch (Exception $e) {
            error_log("Sync GET Materials Warning: " . $e->getMessage());
        }

        // 3. Fetch Quiz History
        $history = [];
        try {
            $stmtHist = $pdo->prepare("SELECT `id`, `title`, `score`, `question_count`, `quiz_type` AS `type`, `review_data`, `created_at` AS `date` FROM `quiz_history` WHERE `user_email` = ? ORDER BY `created_at` DESC");
            $stmtHist->execute([$email]);
            $rawHistory = $stmtHist->fetchAll() ?: [];
            $history = array_map(function($h) {
                if (!empty($h['review_data'])) {
                    $h['reviewData'] = json_decode($h['review_data'], true);
                }
                unset($h['review_data']);
                return $h;
            }, $rawHistory);
        } catch (Exception $e) {
            error_log("Sync GET History Warning: " . $e->getMessage());
        }

        // 4. Fetch User Badges
        $badges = [];
        try {
            $stmtBadge = $pdo->prepare("SELECT `badge_key` FROM `user_badges` WHERE `user_email` = ?");
            $stmtBadge->execute([$email]);
            $badges = $stmtBadge->fetchAll(PDO::FETCH_COLUMN) ?: [];
        } catch (Exception $e) {
            error_log("Sync GET Badges Warning: " . $e->getMessage());
        }

        // 5. Fetch User Chat Conversations
        $chats = [];
        try {
            $stmtChat = $pdo->prepare("SELECT `role`, `message`, `attached_file`, `created_at` FROM `user_chats` WHERE `user_email` = ? ORDER BY `id` ASC");
            $stmtChat->execute([$email]);
            $chats = $stmtChat->fetchAll() ?: [];
        } catch (Exception $e) {
            error_log("Sync GET Chats Warning: " . $e->getMessage());
        }

        // 6. Fetch User Notes
        $notes = [];
        try {
            $stmtNote = $pdo->prepare("SELECT `id`, `title`, `content`, `created_at` FROM `user_notes` WHERE `user_email` = ? ORDER BY `id` DESC");
            $stmtNote->execute([$email]);
            $notes = $stmtNote->fetchAll() ?: [];
        } catch (Exception $e) {
            error_log("Sync GET Notes Warning: " . $e->getMessage());
        }

        $userData = [
            "email" => $user['email'],
            "name" => $user['name'],
            "streak" => (int)($user['streak'] ?? 0),
            "lastActive" => $user['last_active'] ?? date('c'),
            "quizzesTaken" => (int)($user['quizzes_taken'] ?? 0),
            "questionsAnswered" => (int)($user['questions_answered'] ?? 0),
            "correctAnswers" => (int)($user['correct_answers'] ?? 0),
            "studyMinutes" => (int)($user['study_minutes'] ?? 0),
            "mastery" => $mastery ?: new stdClass(),
            "picture" => $user['picture'] ?? null,
            "settings" => $settings ?: new stdClass(),
            "materials" => $materials,
            "history" => $history,
            "badges" => $badges,
            "chats" => $chats,
            "notes" => $notes
        ];

        echo json_encode(["status" => "success", "user" => $userData, "db_driver" => $dbDriver]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}

// ==========================================
// POST ENDPOINT: Synchronize Complete User State
// ==========================================
if ($method === 'POST') {
    $rawInput = isset($GLOBALS['MOCK_INPUT']) ? $GLOBALS['MOCK_INPUT'] : file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    $user = $input['user'] ?? null;

    if (!$user || empty($user['email'])) {
        http_response_code(400);
        echo json_encode(["error" => "User data with email is required."]);
        exit();
    }

    try {
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite') {
            @$pdo->beginTransaction();
        }

        $email = $user['email'];
        $name = $user['name'] ?? $email;
        $password = $user['password'] ?? null;
        $streak = (int)($user['streak'] ?? 0);
        $lastActive = $user['lastActive'] ?? date('c');
        $quizzesTaken = (int)($user['quizzesTaken'] ?? 0);
        $questionsAnswered = (int)($user['questionsAnswered'] ?? 0);
        $correctAnswers = (int)($user['correctAnswers'] ?? 0);
        $studyMinutes = (int)($user['studyMinutes'] ?? 0);

        $masteryJson = isset($user['mastery']) ? json_encode($user['mastery']) : null;
        $picture = $user['picture'] ?? null;
        $settingsJson = isset($user['settings']) ? json_encode($user['settings']) : null;

        // 1. Upsert Profile & Main Stats
        try {
            if ($dbDriver === 'mysql') {
                $stmtUser = $pdo->prepare("
                    INSERT INTO `users` (`email`, `name`, `password`, `streak`, `last_active`, `quizzes_taken`, `questions_answered`, `correct_answers`, `study_minutes`, `mastery`, `picture`, `settings`)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        `name` = VALUES(`name`),
                        `streak` = VALUES(`streak`),
                        `last_active` = VALUES(`last_active`),
                        `quizzes_taken` = VALUES(`quizzes_taken`),
                        `questions_answered` = VALUES(`questions_answered`),
                        `correct_answers` = VALUES(`correct_answers`),
                        `study_minutes` = VALUES(`study_minutes`),
                        `mastery` = VALUES(`mastery`),
                        `picture` = VALUES(`picture`),
                        `settings` = VALUES(`settings`)
                ");
                $stmtUser->execute([$email, $name, $password, $streak, $lastActive, $quizzesTaken, $questionsAnswered, $correctAnswers, $studyMinutes, $masteryJson, $picture, $settingsJson]);
            } else {
                $stmtUser = $pdo->prepare("
                    INSERT OR REPLACE INTO users (email, name, password, streak, last_active, quizzes_taken, questions_answered, correct_answers, study_minutes, mastery, picture, settings)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtUser->execute([$email, $name, $password, $streak, $lastActive, $quizzesTaken, $questionsAnswered, $correctAnswers, $studyMinutes, $masteryJson, $picture, $settingsJson]);
            }
        } catch (Exception $e) {
            error_log("Sync POST Profile Error: " . $e->getMessage());
        }

        // 2. Sync Course Materials
        if (isset($user['materials']) && is_array($user['materials'])) {
            try {
                $existingIds = array_map(function($m) { return $m['id']; }, $user['materials']);
                if (empty($existingIds)) {
                    $stmtDelMat = $pdo->prepare("DELETE FROM `materials` WHERE `user_email` = ?");
                    $stmtDelMat->execute([$email]);
                } else {
                    $inClause = implode(',', array_fill(0, count($existingIds), '?'));
                    $params = array_merge([$email], $existingIds);
                    $stmtDelMat = $pdo->prepare("DELETE FROM `materials` WHERE `user_email` = ? AND `id` NOT IN ($inClause)");
                    $stmtDelMat->execute($params);
                }

                if ($dbDriver === 'mysql') {
                    $stmtMat = $pdo->prepare("
                        INSERT INTO `materials` (`id`, `user_email`, `name`, `size`, `content`, `subject`, `folder`)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            `name` = VALUES(`name`),
                            `size` = VALUES(`size`),
                            `content` = VALUES(`content`),
                            `subject` = VALUES(`subject`),
                            `folder` = VALUES(`folder`)
                    ");
                } else {
                    $stmtMat = $pdo->prepare("
                        INSERT OR REPLACE INTO materials (id, user_email, name, size, content, subject, folder)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ");
                }

                foreach ($user['materials'] as $mat) {
                    $matId = $mat['id'] ?? ('mat-' . time());
                    $matName = $mat['name'] ?? 'Study Document';
                    $matSize = $mat['size'] ?? '1.0 MB';
                    $matContent = $mat['content'] ?? '';
                    $matSubject = $mat['subject'] ?? 'General';
                    $matFolder = $mat['folder'] ?? 'Default';
                    $stmtMat->execute([$matId, $email, $matName, $matSize, $matContent, $matSubject, $matFolder]);
                }
            } catch (Exception $e) {
                error_log("Sync POST Materials Error: " . $e->getMessage());
            }
        }

        // 3. Sync Quiz History
        if (isset($user['history']) && is_array($user['history'])) {
            try {
                $stmtDelHist = $pdo->prepare("DELETE FROM `quiz_history` WHERE `user_email` = ?");
                $stmtDelHist->execute([$email]);

                $stmtHist = $pdo->prepare("
                    INSERT INTO `quiz_history` (`user_email`, `title`, `score`, `question_count`, `quiz_type`, `review_data`)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");

                foreach ($user['history'] as $h) {
                    $title = $h['title'] ?? 'Quiz Session';
                    $score = $h['score'] ?? '100%';
                    $qCount = (int)($h['question_count'] ?? $h['questionCount'] ?? 5);
                    $type = $h['type'] ?? $h['quiz_type'] ?? 'Quiz';
                    $reviewJson = isset($h['reviewData']) ? json_encode($h['reviewData']) : null;
                    $stmtHist->execute([$email, $title, $score, $qCount, $type, $reviewJson]);
                }
            } catch (Exception $e) {
                error_log("Sync POST History Error: " . $e->getMessage());
            }
        }

        // 4. Sync User Badges
        if (isset($user['badges']) && is_array($user['badges'])) {
            try {
                $stmtDelBadges = $pdo->prepare("DELETE FROM `user_badges` WHERE `user_email` = ?");
                $stmtDelBadges->execute([$email]);

                $stmtBadge = $pdo->prepare("
                    INSERT INTO `user_badges` (`user_email`, `badge_key`)
                    VALUES (?, ?)
                ");
                foreach ($user['badges'] as $bKey) {
                    if (is_string($bKey)) {
                        $stmtBadge->execute([$email, $bKey]);
                    }
                }
            } catch (Exception $e) {
                error_log("Sync POST Badges Error: " . $e->getMessage());
            }
        }

        // 5. Sync User AI Chats
        if (isset($user['chats']) && is_array($user['chats'])) {
            try {
                $stmtDelChats = $pdo->prepare("DELETE FROM `user_chats` WHERE `user_email` = ?");
                $stmtDelChats->execute([$email]);

                $stmtChat = $pdo->prepare("
                    INSERT INTO `user_chats` (`user_email`, `role`, `message`, `attached_file`)
                    VALUES (?, ?, ?, ?)
                ");
                foreach ($user['chats'] as $c) {
                    $role = $c['role'] ?? 'user';
                    $msg = $c['message'] ?? '';
                    $att = $c['attached_file'] ?? null;
                    if (!empty($msg)) {
                        $stmtChat->execute([$email, $role, $msg, $att]);
                    }
                }
            } catch (Exception $e) {
                error_log("Sync POST Chats Error: " . $e->getMessage());
            }
        }

        // 6. Sync User Notes
        if (isset($user['notes']) && is_array($user['notes'])) {
            try {
                $stmtDelNotes = $pdo->prepare("DELETE FROM `user_notes` WHERE `user_email` = ?");
                $stmtDelNotes->execute([$email]);

                $stmtNote = $pdo->prepare("
                    INSERT INTO `user_notes` (`user_email`, `title`, `content`)
                    VALUES (?, ?, ?)
                ");
                foreach ($user['notes'] as $n) {
                    $nTitle = $n['title'] ?? 'Study Note';
                    $nContent = $n['content'] ?? '';
                    if (!empty($nContent)) {
                        $stmtNote->execute([$email, $nTitle, $nContent]);
                    }
                }
            } catch (Exception $e) {
                error_log("Sync POST Notes Error: " . $e->getMessage());
            }
        }

        if ($pdo->inTransaction()) {
            @$pdo->commit();
        }

        echo json_encode([
            "status" => "success",
            "message" => "Database synced successfully.",
            "db_driver" => $dbDriver
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            @$pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    exit();
}
?>
?>
