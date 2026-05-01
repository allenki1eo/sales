<?php
$pageTitle = 'Products';

// Load config first for database connection (but don't output anything yet)
require_once __DIR__ . '/config.php';

// Handle Add Product BEFORE any output
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add') {
    $name = $_POST['name'];
    $price = $_POST['price'];
    $carton_weight = $_POST['carton_weight'] ?? 0;
    
    try {
        $stmt = $pdo->prepare("INSERT INTO products (name, default_price, carton_weight) VALUES (?, ?, ?)");
        $stmt->execute([$name, $price, $carton_weight]);
    } catch (PDOException $e) {
        // If carton_weight column doesn't exist, insert without it
        $stmt = $pdo->prepare("INSERT INTO products (name, default_price) VALUES (?, ?)");
        $stmt->execute([$name, $price]);
    }
    
    header("Location: products.php?added=1");
    exit;
}

// Now include header (which outputs HTML)
require_once 'includes/header.php';

// Fetch Products - try with carton_weight, fallback without
try {
    $stmt = $pdo->query("SELECT *, IFNULL(carton_weight, 0) as carton_weight FROM products ORDER BY name");
    $products = $stmt->fetchAll();
} catch (PDOException $e) {
    $stmt = $pdo->query("SELECT *, 0 as carton_weight FROM products ORDER BY name");
    $products = $stmt->fetchAll();
}
?>

<!-- Add New Product Form -->
<div class="card">
    <h3 class="card-title">Add New Product</h3>
    <form method="POST">
        <input type="hidden" name="action" value="add">
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Product Name</label>
                <input type="text" name="name" class="form-control" placeholder="Enter product name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Default Price (TZS)</label>
                <input type="number" name="price" class="form-control" step="0.01" placeholder="0.00" required>
            </div>
            <div class="form-group">
                <label class="form-label">Carton Weight (kg)</label>
                <input type="number" name="carton_weight" class="form-control" step="0.01" placeholder="0.00" value="0">
            </div>
            <div class="form-group" style="display: flex; align-items: flex-end;">
                <button type="submit" class="btn btn-primary btn-block">
                    <i data-lucide="plus" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>
                    Add Product
                </button>
            </div>
        </div>
    </form>
</div>

<!-- Product List -->
<div class="card">
    <div class="flex-header">
        <h3 class="card-title" style="margin-bottom: 0;">Product List</h3>
        <span class="badge badge-secondary"><?php echo count($products); ?> products</span>
    </div>
    
    <!-- Desktop Table View -->
    <div class="table-container desktop-only">
        <table class="table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Default Price</th>
                    <th>Carton Weight</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($products)): ?>
                <tr>
                    <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">No products found</td>
                </tr>
                <?php endif; ?>
                <?php foreach ($products as $product): ?>
                <tr>
                    <td style="font-weight: 500;"><?php echo htmlspecialchars($product['name']); ?></td>
                    <td><?php echo number_format($product['default_price'], 2); ?> TZS</td>
                    <td><?php echo number_format($product['carton_weight'] ?? 0, 2); ?> kg</td>
                    <td>
                        <a href="edit_product.php?id=<?php echo $product['id']; ?>" class="btn btn-secondary btn-sm">
                            <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                        </a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    
    <!-- Mobile Card View -->
    <div class="mobile-only">
        <?php if (empty($products)): ?>
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">No products found</div>
        <?php endif; ?>
        <?php foreach ($products as $product): ?>
        <div class="product-card">
            <div class="product-card-header">
                <div class="product-icon">
                    <i data-lucide="package" style="width: 20px; height: 20px;"></i>
                </div>
                <div class="product-info">
                    <div class="product-name"><?php echo htmlspecialchars($product['name']); ?></div>
                    <div class="product-details">
                        <span><?php echo number_format($product['default_price'], 2); ?> TZS</span>
                        <span>•</span>
                        <span><?php echo number_format($product['carton_weight'] ?? 0, 2); ?> kg</span>
                    </div>
                </div>
                <a href="edit_product.php?id=<?php echo $product['id']; ?>" class="btn btn-secondary btn-sm">
                    <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                </a>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
