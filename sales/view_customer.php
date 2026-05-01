<?php
$pageTitle = 'Customer Portfolio';
require_once 'includes/header.php';

if (!isset($_GET['id'])) {
    header("Location: customers.php");
    exit;
}

$customer_id = (int)$_GET['id'];

// Fetch Customer
try {
    $stmt = $pdo->prepare("SELECT *, IFNULL(is_export, 0) as is_export FROM customers WHERE id = ?");
    $stmt->execute([$customer_id]);
    $customer = $stmt->fetch();
} catch (PDOException $e) {
    $stmt = $pdo->prepare("SELECT *, 0 as is_export FROM customers WHERE id = ?");
    $stmt->execute([$customer_id]);
    $customer = $stmt->fetch();
}

if (!$customer) {
    header("Location: customers.php");
    exit;
}

// Handle price update
$success = '';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_price') {
    $product_id = (int)$_POST['product_id'];
    $new_price = (float)$_POST['price'];
    
    try {
        // Check if custom price exists
        $stmt = $pdo->prepare("SELECT id FROM customer_prices WHERE customer_id = ? AND product_id = ?");
        $stmt->execute([$customer_id, $product_id]);
        $existing = $stmt->fetch();
        
        if ($existing) {
            // Update existing price
            $stmt = $pdo->prepare("UPDATE customer_prices SET price = ? WHERE customer_id = ? AND product_id = ?");
            $stmt->execute([$new_price, $customer_id, $product_id]);
        } else {
            // Insert new custom price
            $stmt = $pdo->prepare("INSERT INTO customer_prices (customer_id, product_id, price) VALUES (?, ?, ?)");
            $stmt->execute([$customer_id, $product_id, $new_price]);
        }
        $success = "Price updated successfully";
    } catch (PDOException $e) {
        $error = "Error updating price: " . $e->getMessage();
    }
}

// Handle reset to default
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'reset_price') {
    $product_id = (int)$_POST['product_id'];
    try {
        $stmt = $pdo->prepare("DELETE FROM customer_prices WHERE customer_id = ? AND product_id = ?");
        $stmt->execute([$customer_id, $product_id]);
        $success = "Price reset to default";
    } catch (PDOException $e) {
        $error = "Error resetting price";
    }
}

// Fetch all products with customer-specific pricing
$stmt = $pdo->query("SELECT * FROM products ORDER BY name");
$products = $stmt->fetchAll();

$stmt = $pdo->prepare("SELECT product_id, price FROM customer_prices WHERE customer_id = ?");
$stmt->execute([$customer_id]);
$custom_prices = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

// Fetch order history for this customer
$stmt = $pdo->prepare("
    SELECT r.*, 
           (SELECT SUM(ri.total_price) FROM request_items ri WHERE ri.request_id = r.id) as total_amount,
           (SELECT COUNT(*) FROM request_items ri WHERE ri.request_id = r.id) as item_count
    FROM requests r 
    WHERE r.customer_id = ? 
    ORDER BY r.request_date DESC, r.created_at DESC
    LIMIT 20
");
$stmt->execute([$customer_id]);
$orders = $stmt->fetchAll();

// Fetch product summary (what products have been shipped)
$stmt = $pdo->prepare("
    SELECT p.name as product_name, 
           SUM(ri.quantity) as total_quantity,
           SUM(ri.total_price) as total_value,
           COUNT(DISTINCT ri.request_id) as order_count
    FROM request_items ri
    JOIN products p ON ri.product_id = p.id
    JOIN requests r ON ri.request_id = r.id
    WHERE r.customer_id = ?
    GROUP BY ri.product_id, p.name
    ORDER BY total_quantity DESC
");
$stmt->execute([$customer_id]);
$product_summary = $stmt->fetchAll();

// Calculate totals
$total_orders = count($orders);
$total_revenue = array_sum(array_column($orders, 'total_amount'));
$total_items = array_sum(array_column($product_summary, 'total_quantity'));
?>

<div class="flex-header" style="margin-bottom: 1.5rem;">
    <div>
        <h2 style="margin: 0; font-size: 1.5rem;"><?php echo htmlspecialchars($customer['name']); ?></h2>
        <div style="display: flex; gap: 1rem; margin-top: 0.5rem; flex-wrap: wrap;">
            <?php if ($customer['location']): ?>
                <span style="color: var(--text-muted); font-size: 0.875rem;">
                    <i data-lucide="map-pin" style="width: 14px; height: 14px;"></i>
                    <?php echo htmlspecialchars($customer['location']); ?>
                </span>
            <?php endif; ?>
            <?php if ($customer['phone']): ?>
                <span style="color: var(--text-muted); font-size: 0.875rem;">
                    <i data-lucide="phone" style="width: 14px; height: 14px;"></i>
                    <?php echo htmlspecialchars($customer['phone']); ?>
                </span>
            <?php endif; ?>
            <?php if ($customer['is_export']): ?>
                <span class="badge badge-warning">Export</span>
            <?php else: ?>
                <span class="badge badge-secondary">Local</span>
            <?php endif; ?>
        </div>
    </div>
    <div style="display: flex; gap: 0.5rem;">
        <a href="edit_customer.php?id=<?php echo $customer_id; ?>" class="btn btn-secondary btn-sm">
            <i data-lucide="edit" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
            Edit
        </a>
        <a href="customers.php" class="btn btn-secondary btn-sm">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
            Back
        </a>
    </div>
</div>

<?php if ($success): ?>
    <div class="alert alert-success"><?php echo $success; ?></div>
<?php endif; ?>
<?php if ($error): ?>
    <div class="alert alert-danger"><?php echo $error; ?></div>
<?php endif; ?>

<!-- Stats Cards -->
<div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
    <div class="card" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 2rem; font-weight: 700; color: var(--primary-color);"><?php echo $total_orders; ?></div>
        <div style="color: var(--text-muted); font-size: 0.875rem;">Total Orders</div>
    </div>
    <div class="card" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 2rem; font-weight: 700; color: #10b981;"><?php echo number_format($total_items); ?></div>
        <div style="color: var(--text-muted); font-size: 0.875rem;">Cartons Shipped</div>
    </div>
    <div class="card" style="text-align: center; padding: 1.5rem;">
        <div style="font-size: 1.25rem; font-weight: 700; color: #f59e0b;"><?php echo number_format($total_revenue, 2); ?></div>
        <div style="color: var(--text-muted); font-size: 0.875rem;">Total Revenue (TZS)</div>
    </div>
</div>

<div class="dashboard-grid">
    <!-- Product Summary -->
    <div class="card">
        <h3 class="card-title">Products Shipped</h3>
        <?php if (empty($product_summary)): ?>
            <p style="color: var(--text-muted); text-align: center; padding: 2rem;">No products shipped yet</p>
        <?php else: ?>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th style="text-align: right;">Quantity</th>
                            <th style="text-align: right;">Orders</th>
                            <th style="text-align: right;">Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($product_summary as $ps): ?>
                        <tr>
                            <td style="font-weight: 500;"><?php echo htmlspecialchars($ps['product_name']); ?></td>
                            <td style="text-align: right;"><?php echo number_format($ps['total_quantity']); ?> ctn</td>
                            <td style="text-align: right;"><?php echo $ps['order_count']; ?></td>
                            <td style="text-align: right;"><?php echo number_format($ps['total_value'], 2); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>

    <!-- Custom Pricing -->
    <div class="card">
        <h3 class="card-title">Custom Pricing</h3>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">
            Set custom prices for this customer. Leave empty to use default price.
        </p>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th style="text-align: right;">Default</th>
                        <th style="text-align: right;">Custom Price</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($products as $product): ?>
                    <?php 
                        $has_custom = isset($custom_prices[$product['id']]);
                        $current_price = $has_custom ? $custom_prices[$product['id']] : $product['default_price'];
                    ?>
                    <tr>
                        <td style="font-weight: 500;"><?php echo htmlspecialchars($product['name']); ?></td>
                        <td style="text-align: right; color: var(--text-muted);"><?php echo number_format($product['default_price'], 2); ?></td>
                        <td style="text-align: right;">
                            <form method="POST" style="display: inline-flex; gap: 0.25rem; align-items: center;">
                                <input type="hidden" name="action" value="update_price">
                                <input type="hidden" name="product_id" value="<?php echo $product['id']; ?>">
                                <input type="number" name="price" step="0.01" value="<?php echo $current_price; ?>" 
                                       style="width: 100px; padding: 0.25rem; border: 1px solid <?php echo $has_custom ? '#10b981' : 'var(--border-color)'; ?>; border-radius: 0.25rem; text-align: right;"
                                       class="form-control">
                        </td>
                        <td>
                                <button type="submit" class="btn btn-primary btn-sm" title="Save">
                                    <i data-lucide="save" style="width: 12px; height: 12px;"></i>
                                </button>
                            </form>
                            <?php if ($has_custom): ?>
                            <form method="POST" style="display: inline;">
                                <input type="hidden" name="action" value="reset_price">
                                <input type="hidden" name="product_id" value="<?php echo $product['id']; ?>">
                                <button type="submit" class="btn btn-secondary btn-sm" title="Reset to default">
                                    <i data-lucide="rotate-ccw" style="width: 12px; height: 12px;"></i>
                                </button>
                            </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Order History -->
<div class="card" style="margin-top: 1.5rem;">
    <div class="flex-header">
        <h3 class="card-title" style="margin-bottom: 0;">Recent Orders</h3>
        <a href="create_request.php" class="btn btn-primary btn-sm">
            <i data-lucide="plus" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
            New Request
        </a>
    </div>
    
    <?php if (empty($orders)): ?>
        <p style="color: var(--text-muted); text-align: center; padding: 2rem;">No orders yet</p>
    <?php else: ?>
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Route</th>
                        <th>Items</th>
                        <th style="text-align: right;">Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($orders as $order): ?>
                    <tr>
                        <td><?php echo date('d M Y', strtotime($order['request_date'])); ?></td>
                        <td><?php echo htmlspecialchars($order['route'] ?? '—'); ?></td>
                        <td><?php echo $order['item_count']; ?> products</td>
                        <td style="text-align: right; font-weight: 500;"><?php echo number_format($order['total_amount'] ?? 0, 2); ?></td>
                        <td>
                            <?php
                            $status_class = [
                                'pending' => 'badge-warning',
                                'approved' => 'badge-success',
                                'dispatched' => 'badge-success',
                                'rejected' => 'badge-danger'
                            ][$order['status']] ?? 'badge-secondary';
                            ?>
                            <span class="badge <?php echo $status_class; ?>"><?php echo ucfirst($order['status']); ?></span>
                        </td>
                        <td>
                            <a href="view_request.php?id=<?php echo $order['id']; ?>" class="btn btn-secondary btn-sm">
                                <i data-lucide="eye" style="width: 14px; height: 14px;"></i>
                            </a>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</div>

<?php require_once 'includes/footer.php'; ?>
