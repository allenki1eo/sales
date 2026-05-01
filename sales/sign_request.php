<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: index.php");
    exit;
}

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

$request_id = $_POST['request_id'] ?? 0;
$action = $_POST['action'] ?? '';

if (!$request_id || !$action) {
    die("Invalid request");
}

$signature_type = '';
$new_status = '';

// Determine signature type based on action and role
// This is a simplified logic, can be expanded
if ($action === 'approve' && $_SESSION['role'] === 'accountant') {
    $signature_type = 'approved_by';
    $new_status = 'approved';
}

if ($signature_type) {
    try {
        $pdo->beginTransaction();

        // Add signature
        $stmt = $pdo->prepare("
            INSERT INTO request_signatures (request_id, signer_id, signature_type) 
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$request_id, $_SESSION['user_id'], $signature_type]);

        // Update status if needed
        if ($new_status) {
            $stmt = $pdo->prepare("UPDATE requests SET status = ? WHERE id = ?");
            $stmt->execute([$new_status, $request_id]);
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        die("Error signing request: " . $e->getMessage());
    }
}

header("Location: view_request.php?id=" . $request_id);
exit;
