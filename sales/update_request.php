<?php
require_once 'config.php';

// Check if user is logged in and is admin
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    header("Location: requests.php");
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: requests.php");
    exit;
}

if (!isset($_POST['request_id'])) {
    header("Location: requests.php");
    exit;
}

$request_id = (int)$_POST['request_id'];

try {
    $pdo->beginTransaction();

    // Update Request
    $stmt = $pdo->prepare("
        UPDATE requests 
        SET customer_id = ?, truck_no = ?, driver_name = ?, route = ?, request_date = ?, status = ?
        WHERE id = ?
    ");
    
    $stmt->execute([
        $_POST['customer_id'],
        $_POST['truck_no'],
        $_POST['driver_name'],
        $_POST['route'],
        $_POST['request_date'],
        $_POST['status'],
        $request_id
    ]);

    // Delete existing items
    $stmt = $pdo->prepare("DELETE FROM request_items WHERE request_id = ?");
    $stmt->execute([$request_id]);

    // Insert new items
    if (isset($_POST['products']) && is_array($_POST['products'])) {
        $stmtItem = $pdo->prepare("
            INSERT INTO request_items (request_id, product_id, quantity, unit_price, total_price) 
            VALUES (?, ?, ?, ?, ?)
        ");

        foreach ($_POST['products'] as $product) {
            if (empty($product['id']) || empty($product['qty'])) continue;

            $qty = (int)$product['qty'];
            $price = (float)$product['price'];
            $total = $qty * $price;

            $stmtItem->execute([
                $request_id,
                $product['id'],
                $qty,
                $price,
                $total
            ]);
        }
    }

    $pdo->commit();
    
    header("Location: view_request.php?id=" . $request_id . "&updated=1");
    exit;

} catch (Exception $e) {
    $pdo->rollBack();
    die("Error updating request: " . $e->getMessage());
}
