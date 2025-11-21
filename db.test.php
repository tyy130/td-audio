<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

$config_path = __DIR__ . '/api/config.php';
if (!file_exists($config_path)) {
    die("config.php not found at $config_path");
}
$config = require $config_path;
var_dump($config);
$mysqli = new mysqli($config['DB_HOST'], $config['DB_USER'], $config['DB_PASS'], $config['DB_NAME']);
if ($mysqli->connect_errno) {
    echo $mysqli->connect_error;
} else {
    echo 'Success!';
}
?>