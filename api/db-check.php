<?php
header('Content-Type: application/json');


$config = require __DIR__ . '/config.php';
$host = $config['DB_HOST'];
$db = $config['DB_NAME'];
$user = $config['DB_USER'];
$pass = $config['DB_PASS'];

try {
    $pdo = new PDO("mysql:host={$host};dbname={$db};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo json_encode(['ok' => true, 'message' => 'Connected to DB', 'host' => $host, 'db' => $db, 'user' => $user]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'DB connection failed', 'error' => $e->getMessage()]);
}
