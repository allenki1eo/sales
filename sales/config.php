<?php
// Database Configuration
$host = 'localhost';
$dbname = 'w2t39uh6cc89r6b9_auditr';
$username = 'w2t39uh6cc89r6b9_root';
$password = 'Z=H6=,p2V)(u';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Database Connection Failed: " . $e->getMessage());
}

// Start Session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Base URL (adjust if needed)
define('BASE_URL', 'http://localhost/sales/');
?>
