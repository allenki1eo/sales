<?php
$pageTitle = 'Edit Product';

// Load config first for database connection (but don't output anything yet)
require_once __DIR__ . '/config.php';

// Check for ID
if (!isset($_GET['id'])) {
    header("Location: products.php");
    exit;
}

$product_id = (int)$_GET['id'];

// Handle DELETE first (before any output)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
    try {
        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
        $stmt->execute([$product_id]);
        header("Location: products.php?deleted=1");
        exit;
    } catch (PDOException $e) {
        // Store error in session to display after redirect fails
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION['delete_error'] = "Cannot delete product. It may be used in existing requests.";
    }
}

// Now include header (which outputs HTML)
require_once 'includes/header.php';

// Fetch Product
$stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
$stmt->execute([$product_id]);
$product = $stmt->fetch();

if (!$product) {
    header("Location: products.php");
    exit;
}

$success = '';
$error = '';

// Check for delete error from session
if (isset($_SESSION['delete_error'])) {
    $error = $_SESSION['delete_error'];
    unset($_SESSION['delete_error']);
}

// Handle Update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'update') {
        $name = trim($_POST['name']);
        $price = (float)$_POST['price'];
        $carton_weight = (float)($_POST['carton_weight'] ?? 0);
        
        if (empty($name)) {
            $error = "Product name is required";
        } else {
            try {
                $stmt = $pdo->prepare("UPDATE products SET name = ?, default_price = ?, carton_weight = ? WHERE id = ?");
                $stmt->execute([$name, $price, $carton_weight, $product_id]);
                $success = "Product updated successfully";
                
                // Refresh product data
                $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
                $stmt->execute([$product_id]);
                $product = $stmt->fetch();
            } catch (PDOException $e) {
                // If carton_weight column doesn't exist, update without it
                try {
                    $stmt = $pdo->prepare("UPDATE products SET name = ?, default_price = ? WHERE id = ?");
                    $stmt->execute([$name, $price, $product_id]);
                    $success = "Product updated successfully (carton weight not saved - column missing)";
                    
                    $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
                    $stmt->execute([$product_id]);
                    $product = $stmt->fetch();
                } catch (PDOException $e2) {
                    $error = "Error updating product: " . $e2->getMessage();
                }
            }
        }
    }
}
?>

<div class="card" style="max-width: 600px; margin: 0 auto;">
    <div class="flex-header" style="margin-bottom: 1.5rem;">
        <h3 class="card-title" style="margin-bottom: 0;">Edit Product</h3>
        <a href="products.php" class="btn btn-secondary btn-sm">
            <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
            Back
        </a>
    </div>
    
    <?php if ($success): ?>
        <div class="alert alert-success"><?php echo $success; ?></div>
    <?php endif; ?>
    <?php if ($error): ?>
        <div class="alert alert-danger"><?php echo $error; ?></div>
    <?php endif; ?>
    
    <form method="POST">
        <input type="hidden" name="action" value="update">
        
        <div class="form-group">
            <label class="form-label">Product Name</label>
            <input type="text" name="name" class="form-control" value="<?php echo htmlspecialchars($product['name']); ?>" required>
        </div>
        
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Default Price (TZS)</label>
                <input type="number" name="price" class="form-control" step="0.01" value="<?php echo $product['default_price']; ?>" required>
            </div>
            <div class="form-group">
                <label class="form-label">Carton Weight (kg)</label>
                <input type="number" name="carton_weight" class="form-control" step="0.01" value="<?php echo $product['carton_weight'] ?? 0; ?>">
            </div>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary" style="flex: 1;">
                <i data-lucide="save" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>
                Save Changes
            </button>
        </div>
    </form>
    
    <!-- Delete Section -->
    <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
        <h4 style="font-size: 0.875rem; font-weight: 600; color: #991b1b; margin-bottom: 0.75rem;">Danger Zone</h4>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">
            Deleting this product will remove it permanently. This action cannot be undone.
        </p>
        <form method="POST" onsubmit="return confirm('Are you sure you want to delete this product? This action cannot be undone.');">
            <input type="hidden" name="action" value="delete">
            <button type="submit" class="btn btn-danger">
                <i data-lucide="trash-2" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>
                Delete Product
            </button>
        </form>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
