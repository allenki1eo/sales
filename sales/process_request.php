<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: create_request.php");
    exit;
}

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

try {
    $pdo->beginTransaction();

    // Insert Request
    $stmt = $pdo->prepare("
        INSERT INTO requests (user_id, customer_id, truck_no, driver_name, route, request_date, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
    ");
    
    $stmt->execute([
        $_SESSION['user_id'],
        $_POST['customer_id'],
        $_POST['truck_no'],
        $_POST['driver_name'],
        $_POST['route'],
        $_POST['request_date']
    ]);
    
    $request_id = $pdo->lastInsertId();

    // Insert Request Items
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

    // Add initial signature (Prepared by)
    $stmtSig = $pdo->prepare("
        INSERT INTO request_signatures (request_id, signer_id, signature_type) 
        VALUES (?, ?, 'prepared_by')
    ");
    $stmtSig->execute([$request_id, $_SESSION['user_id']]);

    $pdo->commit();
    
    header("Location: view_request.php?id=" . $request_id);
    exit;

} catch (Exception $e) {
    $pdo->rollBack();
    die("Error processing request: " . $e->getMessage());
}
