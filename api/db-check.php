<?php
header('Content-Type: application/json');

$host = getenv('DB_HOST') ?: 'srv995.hstgr.io';
$db = getenv('DB_NAME') ?: 'u792097907_slug_dev';
$user = getenv('DB_USER') ?: 'u792097907_slug_user';
$pass = getenv('DB_PASS') ?: 'QYw?A#bOQnS';

try {
    $pdo = new PDO("mysql:host={$host};dbname={$db};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo json_encode(['ok' => true, 'message' => 'Connected to DB', 'host' => $host, 'db' => $db, 'user' => $user]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'DB connection failed', 'error' => $e->getMessage()]);
}
