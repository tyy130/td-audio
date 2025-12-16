<?php
// Simple GitHub webhook deploy script for Hostinger

// For security, read the webhook secret from an environment variable on the server.
$secret = getenv('GITHUB_HOOK_SECRET') ?: null; // Set this in Hostinger or via your shell; do not commit secrets
if (!$secret) {
    http_response_code(403);
    exit('Missing webhook secret configuration on server');
}

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
