<?php
require_once __DIR__ . '/env_loader.php';

// Load environment variables
loadEnv(__DIR__ . '/.env');

// Database Configuration
$dbDriver = env('DB_DRIVER', 'sqlite');

// Start Session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    if ($dbDriver === 'mysql') {
        // MySQL Connection
        $host = env('DB_HOST', 'localhost');
        $port = env('DB_PORT', '3306');
        $dbname = env('DB_NAME', 'sales');
        $username = env('DB_USER', 'root');
        $password = env('DB_PASS', '');

        $pdo = new PDO("mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4", $username, $password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);

    } elseif ($dbDriver === 'sqlite') {
        // SQLite Connection (local file - compatible with Turso local replicas)
        $sqlitePath = env('DB_SQLITE_PATH', __DIR__ . '/database.sqlite');

        // If path is relative, make it absolute from project root
        if (!file_exists($sqlitePath) && substr($sqlitePath, 0, 1) !== '/' && substr($sqlitePath, 0, 1) !== '\\') {
            $sqlitePath = __DIR__ . '/' . $sqlitePath;
        }

        $pdo = new PDO("sqlite:$sqlitePath");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // Enable foreign key constraints (disabled by default in SQLite)
        $pdo->exec('PRAGMA foreign_keys = ON;');
        
        // Enable WAL mode for better concurrency (optional but recommended)
        $pdo->exec('PRAGMA journal_mode = WAL;');

    } else {
        throw new Exception("Unsupported DB_DRIVER: $dbDriver. Use 'mysql' or 'sqlite'.");
    }
} catch (Exception $e) {
    die("Database Connection Failed: " . $e->getMessage());
}

// Base URL (adjust if needed)
$baseUrl = env('BASE_URL', 'http://localhost/sales/');
define('BASE_URL', $baseUrl);
?>
