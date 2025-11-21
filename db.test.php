<?php
$config_path = __DIR__ . '/api/config.php';
if (!file_exists($config_path)) {
    die("config.php not found at $config_path");
}
$config = require $config_path;
$mysqli = new mysqli($config['DB_HOST'], $config['DB_USER'], $config['DB_PASS'], $config['DB_NAME']);
if ($mysqli->connect_errno) {
    echo $mysqli->connect_error;
} else {
    echo 'DB connection successful!';
}
?>