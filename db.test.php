<?php
$mysqli = new mysqli(getenv('DB_HOST'), getenv('DB_USER'), getenv('DB_PASS'), getenv('DB_NAME'));
if ($mysqli->connect_errno) {
    echo $mysqli->connect_error;
} else {
    echo 'Success!';
}
?>
