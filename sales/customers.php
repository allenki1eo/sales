<?php
$pageTitle = 'Customers';

// Load config first for database connection (but don't output anything yet)
require_once __DIR__ . '/config.php';

// Handle Add Customer BEFORE any output
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add') {
    $name = $_POST['name'];
    $location = $_POST['location'];
    $phone = $_POST['phone'];
    $is_export = isset($_POST['is_export']) ? 1 : 0;
    $charges_efd = isset($_POST['charges_efd']) ? 1 : 0;
    $efd_profit_per_carton = floatval($_POST['efd_profit_per_carton'] ?? 2000);
    
    try {
        $stmt = $pdo->prepare("INSERT INTO customers (name, location, phone, is_export, charges_efd, efd_profit_per_carton) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $location, $phone, $is_export, $charges_efd, $efd_profit_per_carton]);
    } catch (PDOException $e) {
        // Fallback if new columns don't exist yet
        try {
            $stmt = $pdo->prepare("INSERT INTO customers (name, location, phone, is_export) VALUES (?, ?, ?, ?)");
            $stmt->execute([$name, $location, $phone, $is_export]);
        } catch (PDOException $e2) {
            $stmt = $pdo->prepare("INSERT INTO customers (name, location, phone) VALUES (?, ?, ?)");
            $stmt->execute([$name, $location, $phone]);
        }
    }
    
    header("Location: customers.php?added=1");
    exit;
}

// Now include header (which outputs HTML)
require_once 'includes/header.php';

// Pagination and Search
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$per_page = 10;
$offset = ($page - 1) * $per_page;
$search = isset($_GET['search']) ? trim($_GET['search']) : '';

// Build search condition
$search_condition = '';
$search_params = [];
if (!empty($search)) {
    $search_condition = " WHERE (name LIKE ? OR location LIKE ? OR phone LIKE ?)";
    $search_term = "%" . $search . "%";
    $search_params = [$search_term, $search_term, $search_term];
}

// Count total customers (with search filter)
if (!empty($search)) {
    $count_stmt = $pdo->prepare("SELECT COUNT(*) FROM customers" . $search_condition);
    $count_stmt->execute($search_params);
    $total_customers = $count_stmt->fetchColumn();
} else {
    $total_customers = $pdo->query("SELECT COUNT(*) FROM customers")->fetchColumn();
}
$total_pages = ceil($total_customers / $per_page);

// Fetch Customers with pagination and search
try {
    $sql = "SELECT *, IFNULL(is_export, 0) as is_export FROM customers" . $search_condition . " ORDER BY name LIMIT ? OFFSET ?";
    $stmt = $pdo->prepare($sql);
    $param_index = 1;
    foreach ($search_params as $param) {
        $stmt->bindValue($param_index++, $param);
    }
    $stmt->bindValue($param_index++, $per_page, PDO::PARAM_INT);
    $stmt->bindValue($param_index, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $customers = $stmt->fetchAll();
} catch (PDOException $e) {
    $sql = "SELECT *, 0 as is_export FROM customers" . $search_condition . " ORDER BY name LIMIT ? OFFSET ?";
    $stmt = $pdo->prepare($sql);
    $param_index = 1;
    foreach ($search_params as $param) {
        $stmt->bindValue($param_index++, $param);
    }
    $stmt->bindValue($param_index++, $per_page, PDO::PARAM_INT);
    $stmt->bindValue($param_index, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $customers = $stmt->fetchAll();
}

// Helper function to build URL with search param preserved
function buildUrl($page, $search) {
    $params = ['page' => $page];
    if (!empty($search)) {
        $params['search'] = $search;
    }
    return '?' . http_build_query($params);
}
?>

<!-- Add New Customer Form -->
<div class="card">
    <h3 class="card-title">Add New Customer</h3>
    <form method="POST">
        <input type="hidden" name="action" value="add">
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Customer Name</label>
                <input type="text" name="name" class="form-control" placeholder="Enter customer name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Location</label>
                <input type="text" name="location" class="form-control" placeholder="Enter location">
            </div>
            <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="text" name="phone" class="form-control" placeholder="Enter phone number">
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; justify-content: flex-end; gap: 0.5rem;">
                <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.4rem 0;">
                    <input type="checkbox" name="is_export" value="1" style="width: 18px; height: 18px;">
                    <span><strong>Export Customer</strong> <small style="color: var(--text-muted);">(VAT Exclusive)</small></span>
                </label>
                <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.4rem 0;" title="Customer uses your EFD machine and is charged 18% on profit per carton">
                    <input type="checkbox" name="charges_efd" value="1" id="new_efd_chk" style="width: 18px; height: 18px;" onchange="document.getElementById('new_efd_row').style.display = this.checked ? 'flex' : 'none'">
                    <span><strong>EFD Machine Customer</strong> <small style="color: var(--text-muted);">(18% of profit/carton)</small></span>
                </label>
                <div id="new_efd_row" style="display: none; align-items: center; gap: 0.5rem; background: #fff7ed; padding: 0.4rem 0.6rem; border-radius: 0.4rem; border: 1px solid #fed7aa;">
                    <label style="font-size: 0.8rem; white-space: nowrap; margin: 0;">Profit/carton:</label>
                    <input type="number" name="efd_profit_per_carton" class="form-control" value="2000" min="0" step="0.01" style="flex:1;">
                    <small style="color: var(--text-muted); white-space: nowrap;">TZS</small>
                </div>
            </div>
        </div>
        <button type="submit" class="btn btn-primary">
            <i data-lucide="user-plus" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>
            Add Customer
        </button>
    </form>
</div>

<!-- Customer List -->
<div class="card">
    <div class="flex-header" style="flex-wrap: wrap; gap: 1rem;">
        <h3 class="card-title" style="margin-bottom: 0;">Customer List</h3>
        <span class="badge badge-secondary"><?php echo $total_customers; ?> customer<?php echo $total_customers != 1 ? 's' : ''; ?></span>
    </div>
    
    <!-- Search Bar -->
    <form method="GET" class="search-form" style="margin: 1rem 0;">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px; position: relative;">
                <i data-lucide="search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; color: var(--text-muted);"></i>
                <input type="text" name="search" class="form-control" 
                       placeholder="Search by name, location, or phone..." 
                       value="<?php echo htmlspecialchars($search); ?>"
                       style="padding-left: 40px;">
            </div>
            <button type="submit" class="btn btn-primary">
                <i data-lucide="search" style="width: 16px; height: 16px; margin-right: 0.25rem;"></i>
                Search
            </button>
            <?php if (!empty($search)): ?>
            <a href="customers.php" class="btn btn-secondary">
                <i data-lucide="x" style="width: 16px; height: 16px; margin-right: 0.25rem;"></i>
                Clear
            </a>
            <?php endif; ?>
        </div>
    </form>
    
    <?php if (!empty($search)): ?>
    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f0f9ff; border-radius: 0.5rem; border: 1px solid #bae6fd;">
        <span style="color: #0369a1; font-size: 0.875rem;">
            <i data-lucide="info" style="width: 14px; height: 14px; display: inline; vertical-align: middle;"></i>
            Showing results for "<strong><?php echo htmlspecialchars($search); ?></strong>"
            <?php if ($total_customers == 0): ?>
                — No matches found
            <?php endif; ?>
        </span>
    </div>
    <?php endif; ?>
    
    <!-- Desktop Table View -->
    <div class="table-container desktop-only">
        <table class="table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Phone</th>
                    <th>Type</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($customers)): ?>
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">No customers found</td>
                </tr>
                <?php endif; ?>
                <?php foreach ($customers as $customer): ?>
                <tr>
                    <td style="font-weight: 500;"><?php echo htmlspecialchars($customer['name']); ?></td>
                    <td>
                        <?php if ($customer['location']): ?>
                            <i data-lucide="map-pin" style="width: 14px; height: 14px; margin-right: 0.25rem; color: var(--text-muted);"></i>
                            <?php echo htmlspecialchars($customer['location']); ?>
                        <?php else: ?>
                            <span style="color: var(--text-muted);">—</span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <?php if ($customer['phone']): ?>
                            <i data-lucide="phone" style="width: 14px; height: 14px; margin-right: 0.25rem; color: var(--text-muted);"></i>
                            <?php echo htmlspecialchars($customer['phone']); ?>
                        <?php else: ?>
                            <span style="color: var(--text-muted);">—</span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <?php if ($customer['is_export']): ?>
                            <span class="badge badge-warning">Export</span>
                        <?php else: ?>
                            <span class="badge badge-secondary">Local</span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <div style="display: flex; gap: 0.25rem;">
                            <a href="view_customer.php?id=<?php echo $customer['id']; ?>" class="btn btn-primary btn-sm" title="View Portfolio">
                                <i data-lucide="user" style="width: 14px; height: 14px;"></i>
                            </a>
                            <a href="edit_customer.php?id=<?php echo $customer['id']; ?>" class="btn btn-secondary btn-sm" title="Edit">
                                <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                            </a>
                        </div>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    
    <!-- Mobile Card View -->
    <div class="mobile-only">
        <?php if (empty($customers)): ?>
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">No customers found</div>
        <?php endif; ?>
        <?php foreach ($customers as $customer): ?>
        <div class="customer-card">
            <div class="customer-card-header">
                <div class="customer-avatar">
                    <?php echo strtoupper(substr($customer['name'], 0, 1)); ?>
                </div>
                <div class="customer-info">
                    <div class="customer-name"><?php echo htmlspecialchars($customer['name']); ?></div>
                    <?php if ($customer['location']): ?>
                    <div class="customer-detail">
                        <i data-lucide="map-pin" style="width: 12px; height: 12px;"></i>
                        <?php echo htmlspecialchars($customer['location']); ?>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <div class="customer-card-footer">
                <a href="view_customer.php?id=<?php echo $customer['id']; ?>" class="btn btn-primary btn-sm">
                    <i data-lucide="user" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
                    Portfolio
                </a>
                <?php if ($customer['phone']): ?>
                <a href="tel:<?php echo htmlspecialchars($customer['phone']); ?>" class="btn btn-secondary btn-sm">
                    <i data-lucide="phone" style="width: 14px; height: 14px;"></i>
                </a>
                <?php endif; ?>
                <a href="edit_customer.php?id=<?php echo $customer['id']; ?>" class="btn btn-secondary btn-sm">
                    <i data-lucide="edit" style="width: 14px; height: 14px;"></i>
                </a>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    
    <!-- Pagination -->
    <?php if ($total_pages > 1): ?>
    <div class="pagination">
        <?php if ($page > 1): ?>
        <a href="<?php echo buildUrl($page - 1, $search); ?>" class="btn btn-secondary btn-sm">
            <i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i>
        </a>
        <?php endif; ?>
        
        <?php
        // Show page numbers
        $start_page = max(1, $page - 2);
        $end_page = min($total_pages, $page + 2);
        
        if ($start_page > 1): ?>
            <a href="<?php echo buildUrl(1, $search); ?>" class="btn btn-secondary btn-sm pagination-btn">1</a>
            <?php if ($start_page > 2): ?>
                <span class="pagination-ellipsis">...</span>
            <?php endif; ?>
        <?php endif; ?>
        
        <?php for ($i = $start_page; $i <= $end_page; $i++): ?>
            <a href="<?php echo buildUrl($i, $search); ?>" class="btn <?php echo $i === $page ? 'btn-primary' : 'btn-secondary'; ?> btn-sm pagination-btn">
                <?php echo $i; ?>
            </a>
        <?php endfor; ?>
        
        <?php if ($end_page < $total_pages): ?>
            <?php if ($end_page < $total_pages - 1): ?>
                <span class="pagination-ellipsis">...</span>
            <?php endif; ?>
            <a href="<?php echo buildUrl($total_pages, $search); ?>" class="btn btn-secondary btn-sm pagination-btn"><?php echo $total_pages; ?></a>
        <?php endif; ?>
        
        <?php if ($page < $total_pages): ?>
        <a href="<?php echo buildUrl($page + 1, $search); ?>" class="btn btn-secondary btn-sm">
            <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
        </a>
        <?php endif; ?>
    </div>
    <div class="pagination-info">
        Showing <?php echo $offset + 1; ?>-<?php echo min($offset + $per_page, $total_customers); ?> of <?php echo $total_customers; ?> customers
    </div>
    <?php endif; ?>
</div>

<?php require_once 'includes/footer.php'; ?>
