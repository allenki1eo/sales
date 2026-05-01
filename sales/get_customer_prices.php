<?php
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_GET['customer_id'])) {
    echo json_encode(['error' => 'Customer ID required']);
    exit;
}

$customer_id = (int)$_GET['customer_id'];

// Fetch all products
$stmt = $pdo->query("SELECT * FROM products");
$products = $stmt->fetchAll();

// Fetch specific prices for this customer
$stmt = $pdo->prepare("SELECT product_id, price FROM customer_prices WHERE customer_id = ?");
$stmt->execute([$customer_id]);
$customer_prices = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

// Merge prices
$result = [];
foreach ($products as $product) {
    $price = isset($customer_prices[$product['id']]) ? $customer_prices[$product['id']] : $product['default_price'];
    $result[] = [
        'id' => $product['id'],
        'name' => $product['name'],
        'price' => (float)$price
    ];
}

echo json_encode($result);
