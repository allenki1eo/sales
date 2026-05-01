<?php
$pageTitle = 'Edit Customer';

// Load config first for database connection (but don't output anything yet)
require_once __DIR__ . '/config.php';

// Check for ID
if (!isset($_GET['id'])) {
    header("Location: customers.php");
    exit;
}

$customer_id = (int)$_GET['id'];

// Handle DELETE first (before any output)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete') {
    try {
        $stmt = $pdo->prepare("DELETE FROM customers WHERE id = ?");
        $stmt->execute([$customer_id]);
        header("Location: customers.php?deleted=1");
        exit;
    } catch (PDOException $e) {
        // Store error in session to display after redirect fails
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        $_SESSION['delete_error'] = "Cannot delete customer. They may have existing requests.";
    }
}

// Now include header (which outputs HTML)
require_once 'includes/header.php';

// Fetch Customer
try {
    $stmt = $pdo->prepare("SELECT *, IFNULL(is_export, 0) as is_export, IFNULL(charges_efd, 0) as charges_efd, IFNULL(efd_profit_per_carton, 2000) as efd_profit_per_carton FROM customers WHERE id = ?");
    $stmt->execute([$customer_id]);
    $customer = $stmt->fetch();
} catch (PDOException $e) {
    $stmt = $pdo->prepare("SELECT *, 0 as is_export, 0 as charges_efd, 2000 as efd_profit_per_carton FROM customers WHERE id = ?");
    $stmt->execute([$customer_id]);
    $customer = $stmt->fetch();
}

if (!$customer) {
    header("Location: customers.php");
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
        $location = trim($_POST['location']);
        $phone = trim($_POST['phone']);
        $is_export = isset($_POST['is_export']) ? 1 : 0;
        $charges_efd = isset($_POST['charges_efd']) ? 1 : 0;
        $efd_profit_per_carton = floatval($_POST['efd_profit_per_carton'] ?? 2000);
        
        if (empty($name)) {
            $error = "Customer name is required";
        } else {
            try {
                $stmt = $pdo->prepare("UPDATE customers SET name = ?, location = ?, phone = ?, is_export = ?, charges_efd = ?, efd_profit_per_carton = ? WHERE id = ?");
                $stmt->execute([$name, $location, $phone, $is_export, $charges_efd, $efd_profit_per_carton, $customer_id]);
                $success = "Customer updated successfully";
                
                // Refresh customer data
                $stmt = $pdo->prepare("SELECT *, IFNULL(is_export, 0) as is_export, IFNULL(charges_efd, 0) as charges_efd, IFNULL(efd_profit_per_carton, 2000) as efd_profit_per_carton FROM customers WHERE id = ?");
                $stmt->execute([$customer_id]);
                $customer = $stmt->fetch();
            } catch (PDOException $e) {
                // Fallback if new columns don't exist yet
                try {
                    $stmt = $pdo->prepare("UPDATE customers SET name = ?, location = ?, phone = ?, is_export = ? WHERE id = ?");
                    $stmt->execute([$name, $location, $phone, $is_export, $customer_id]);
                    $success = "Customer updated successfully (run migration for EFD fields)";
                    
                    $stmt = $pdo->prepare("SELECT *, 0 as is_export, 0 as charges_efd, 2000 as efd_profit_per_carton FROM customers WHERE id = ?");
                    $stmt->execute([$customer_id]);
                    $customer = $stmt->fetch();
                } catch (PDOException $e2) {
                    $error = "Error updating customer: " . $e2->getMessage();
                }
            }
        }
    }
}
?>

<div class="card" style="max-width: 600px; margin: 0 auto;">
    <div class="flex-header" style="margin-bottom: 1.5rem;">
        <h3 class="card-title" style="margin-bottom: 0;">Edit Customer</h3>
        <a href="customers.php" class="btn btn-secondary btn-sm">
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
            <label class="form-label">Customer Name</label>
            <input type="text" name="name" class="form-control" value="<?php echo htmlspecialchars($customer['name']); ?>" required>
        </div>
        
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Location</label>
                <input type="text" name="location" class="form-control" value="<?php echo htmlspecialchars($customer['location'] ?? ''); ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="text" name="phone" class="form-control" value="<?php echo htmlspecialchars($customer['phone'] ?? ''); ?>">
            </div>
        </div>
        
        <div class="form-group" style="padding: 1rem; background: #f9fafb; border-radius: 0.5rem; border: 1px solid var(--border-color);">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0;">
                <input type="checkbox" name="is_export" value="1" <?php echo $customer['is_export'] ? 'checked' : ''; ?> style="width: 20px; height: 20px;">
                <div>
                    <strong style="display: block;">Export Customer</strong>
                    <small style="color: var(--text-muted);">Prices are VAT Exclusive (no VAT charged)</small>
                </div>
            </label>
        </div>

        <div class="form-group" style="padding: 1rem; background: #fff7ed; border-radius: 0.5rem; border: 1px solid #fed7aa;">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0 0 0.75rem 0;">
                <input type="checkbox" name="charges_efd" value="1" id="efd_checkbox" <?php echo ($customer['charges_efd'] ?? 0) ? 'checked' : ''; ?> style="width: 20px; height: 20px;" onchange="document.getElementById('efd_profit_row').style.display = this.checked ? 'block' : 'none'">
                <div>
                    <strong style="display: block;">EFD Machine Customer</strong>
                    <small style="color: var(--text-muted);">Charged 18% of profit per carton for using EFD machine</small>
                </div>
            </label>
            <div id="efd_profit_row" style="display: <?php echo ($customer['charges_efd'] ?? 0) ? 'block' : 'none'; ?>; margin-top: 0.5rem;">
                <label class="form-label" style="font-size: 0.8rem;">Profit per Carton (TZS)</label>
                <input type="number" name="efd_profit_per_carton" class="form-control" 
                       value="<?php echo number_format($customer['efd_profit_per_carton'] ?? 2000, 2, '.', ''); ?>"
                       min="0" step="0.01" placeholder="e.g. 2000">
                <small style="color: var(--text-muted);">EFD charge per carton = <?php echo number_format(($customer['efd_profit_per_carton'] ?? 2000) * 0.18, 2); ?> TZS (18% of profit)</small>
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
            Deleting this customer will remove them permanently. This action cannot be undone.
        </p>
        <form method="POST" onsubmit="return confirm('Are you sure you want to delete this customer? This action cannot be undone.');">
            <input type="hidden" name="action" value="delete">
            <button type="submit" class="btn btn-danger">
                <i data-lucide="trash-2" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>
                Delete Customer
            </button>
        </form>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
