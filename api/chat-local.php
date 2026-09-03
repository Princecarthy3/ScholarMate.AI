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

$BACKEND_OPENROUTER_API_KEY = getenv('OPENROUTER_API_KEY') ?: '';

// For local XAMPP development only, you may temporarily place your key here.
// Never commit a real key to GitHub or expose it in frontend JavaScript.
if (empty($BACKEND_OPENROUTER_API_KEY)) {
    $BACKEND_OPENROUTER_API_KEY = 'YOUR_OPENROUTER_API_KEY_HERE';
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$message = $input['message'] ?? '';

if (empty($BACKEND_OPENROUTER_API_KEY) || $BACKEND_OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {
    http_response_code(500);
    echo json_encode([
        "error" => "OPENROUTER_API_KEY is missing. Set the OPENROUTER_API_KEY server environment variable or configure api/chat-local.php for local development."
    ]);
    exit();
}

if (empty($message) && empty($input['inlineData']['data'])) {
    http_response_code(400);
    echo json_encode(["error" => "Message or image is required"]);
    exit();
}

$userContent = [[
    "type" => "text",
    "text" => !empty($message) ? $message : "Analyze the attached image and explain the concepts shown."
]];

if (!empty($input['inlineData']['data'])) {
    $mimeType = $input['inlineData']['mimeType'] ?? 'image/jpeg';
    $userContent[] = [
        "type" => "image_url",
        "image_url" => [
            "url" => "data:{$mimeType};base64," . $input['inlineData']['data']
        ]
    ];
}

$models = [
    getenv('OPENROUTER_MODEL') ?: 'google/gemma-4-31b-it:free',
    getenv('OPENROUTER_FALLBACK_MODEL') ?: 'google/gemma-4-26b-a4b-it:free',
    'openrouter/free'
];

$lastResponse = null;
$lastHttpCode = 503;

foreach ($models as $model) {
    $payload = json_encode([
        "model" => $model,
        "messages" => [[
            "role" => "user",
            "content" => $userContent
        ]],
        "temperature" => 0.4,
        "max_tokens" => 4096
    ]);

    $ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . trim($BACKEND_OPENROUTER_API_KEY),
            'HTTP-Referer: http://localhost',
            'X-Title: ScholarMate AI'
        ],
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode >= 200 && $httpCode < 300 && $response) {
        http_response_code(200);
        echo $response;
        exit();
    }

    $lastResponse = $response ?: json_encode(["error" => $curlError ?: "OpenRouter request failed"]);
    $lastHttpCode = $httpCode ?: 503;
}

http_response_code($lastHttpCode);
echo $lastResponse ?: json_encode(["error" => "AI generation unavailable. Please try again shortly."]);
?>
