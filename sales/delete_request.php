<?php
require_once 'config.php';

// Check if user is logged in and is admin
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    header("Location: requests.php");
    exit;
}

if (!isset($_GET['id'])) {
    header("Location: requests.php");
    exit;
}

$request_id = (int)$_GET['id'];

try {
    $pdo->beginTransaction();

    // Delete request signatures first (foreign key constraint)
    $stmt = $pdo->prepare("DELETE FROM request_signatures WHERE request_id = ?");
    $stmt->execute([$request_id]);

    // Delete request items (foreign key constraint)
    $stmt = $pdo->prepare("DELETE FROM request_items WHERE request_id = ?");
    $stmt->execute([$request_id]);

    // Delete the request itself
    $stmt = $pdo->prepare("DELETE FROM requests WHERE id = ?");
    $stmt->execute([$request_id]);

    $pdo->commit();

    header("Location: requests.php?deleted=1");
    exit;

} catch (Exception $e) {
    $pdo->rollBack();
    die("Error deleting request: " . $e->getMessage());
}
