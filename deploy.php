<?php
// Simple GitHub webhook deploy script for Hostinger

$secret = 'REPLACE_WITH_A_STRONG_SECRET'; // Set a strong secret and use it in your webhook

// Validate secret if sent as a header (recommended)
if (!isset($_SERVER['HTTP_X_HUB_SIGNATURE'])) {
    http_response_code(403);
    exit('Forbidden');
}

// Get payload and verify signature
$payload = file_get_contents('php://input');
$signature = 'sha1=' . hash_hmac('sha1', $payload, $secret);

if (!hash_equals($signature, $_SERVER['HTTP_X_HUB_SIGNATURE'])) {
    http_response_code(403);
    exit('Invalid signature');
}

// Run git pull
$output = [];
exec('cd ' . __DIR__ . ' && git pull 2>&1', $output, $exitCode);

if ($exitCode === 0) {
    echo "Deploy successful:\n" . implode("\n", $output);
} else {
    http_response_code(500);
    echo "Deploy failed:\n" . implode("\n", $output);
}
?>
