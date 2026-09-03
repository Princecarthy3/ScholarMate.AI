<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit();
}

// CENTRALIZED BACKEND GEMINI API KEY
$BACKEND_GEMINI_API_KEY = getenv('GEMINI_API_KEY') ?: '';

$input = json_decode(file_get_contents('php://input'), true);
$message = $input['message'] ?? '';

$apiKey = !empty($BACKEND_GEMINI_API_KEY) ? trim($BACKEND_GEMINI_API_KEY) : '';

if (empty($message)) {
    http_response_code(400);
    echo json_encode(["error" => "Message is required"]);
    exit();
}

if (empty($apiKey)) {
    http_response_code(400);
    echo json_encode(["error" => "Centralized Backend Gemini API Key is missing. Please paste your Gemini API Key in api/chat.php ($BACKEND_GEMINI_API_KEY) or api/chat.js (CENTRALIZED_GEMINI_API_KEY)."]);
    exit();
}

$models = [
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash'
];
$parts = [
    ["text" => !empty($message) ? $message : "Analyze this attached image and explain the concepts shown."]
];
if (!empty($input['inlineData']) && !empty($input['inlineData']['data'])) {
    $parts[] = [
        "inline_data" => [
            "mime_type" => $input['inlineData']['mimeType'] ?? "image/jpeg",
            "data" => $input['inlineData']['data']
        ]
    ];
}

$payload = json_encode([
    "contents" => [
        [
            "parts" => $parts
        ]
    ]
]);

$lastResponse = null;
$lastHttpCode = 500;

// Try API Key query param mode and Bearer token header mode across models
foreach ($models as $model) {
    // Mode 1: Direct API Key query parameter (Fastest response path)
    $urlKey = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);
    $ch1 = curl_init($urlKey);
    curl_setopt($ch1, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch1, CURLOPT_POST, true);
    curl_setopt($ch1, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch1, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch1, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch1, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch1, CURLOPT_SSL_VERIFYPEER, false);

    $res1 = curl_exec($ch1);
    $code1 = curl_getinfo($ch1, CURLINFO_HTTP_CODE);
    curl_close($ch1);

    if ($code1 >= 200 && $code1 < 300) {
        http_response_code(200);
        echo $res1;
        exit();
    }

    // Mode 2: Authorization: Bearer <token>
    $urlBearer = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";
    $ch2 = curl_init($urlBearer);
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_POST, true);
    curl_setopt($ch2, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch2, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch2, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch2, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);

    $res2 = curl_exec($ch2);
    $code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);

    if ($code2 >= 200 && $code2 < 300) {
        http_response_code(200);
        echo $res2;
        exit();
    }

    $lastResponse = $res1 ?: $res2;
    $lastHttpCode = $code1 ?: $code2;
}

// Return Google API response if unsuccessful
http_response_code($lastHttpCode ?: 500);
echo $lastResponse;
?>
