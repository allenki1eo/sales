<?php
$pageTitle = 'Dashboard';
require_once 'includes/header.php';

// ===== MONTH FILTER =====
// Accept ?month=YYYY-MM from GET, default to current month
$selected_month = isset($_GET['month']) && preg_match('/^\d{4}-\d{2}$/', $_GET['month'])
    ? $_GET['month']
    : date('Y-m');

// Parse selected month for display and DB queries
$selected_month_label = date('F Y', strtotime($selected_month . '-01'));
$selected_year        = substr($selected_month, 0, 4);

// ===== CORE STATS (filtered by selected month) =====
$stmt = $pdo->prepare("SELECT COUNT(*) FROM requests WHERE status = 'pending' AND DATE_FORMAT(request_date,'%Y-%m') = ?");
$stmt->execute([$selected_month]);
$pending_requests = $stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM requests WHERE status = 'approved' AND DATE_FORMAT(request_date,'%Y-%m') = ?");
$stmt->execute([$selected_month]);
$approved_requests = $stmt->fetchColumn();

$stmt = $pdo->query("SELECT COUNT(*) FROM customers");
$total_customers = $stmt->fetchColumn();

$stmt = $pdo->query("SELECT COUNT(*) FROM products");
$total_products = $stmt->fetchColumn();

// ===== SALES STATS =====
// Total revenue (all time)
$stmt = $pdo->query("SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0) FROM request_items ri JOIN requests r ON ri.request_id = r.id");
$total_revenue = $stmt->fetchColumn();

// Selected month revenue
$stmt = $pdo->prepare("SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0) FROM request_items ri JOIN requests r ON ri.request_id = r.id WHERE DATE_FORMAT(r.request_date, '%Y-%m') = ?");
$stmt->execute([$selected_month]);
$monthly_revenue = $stmt->fetchColumn();

// Total cartons sold
$stmt = $pdo->query("SELECT COALESCE(SUM(quantity), 0) FROM request_items");
$total_cartons = $stmt->fetchColumn();

// Selected month cartons
$stmt = $pdo->prepare("SELECT COALESCE(SUM(ri.quantity), 0) FROM request_items ri JOIN requests r ON ri.request_id = r.id WHERE DATE_FORMAT(r.request_date, '%Y-%m') = ?");
$stmt->execute([$selected_month]);
$monthly_cartons = $stmt->fetchColumn();

// Total orders
$stmt = $pdo->query("SELECT COUNT(*) FROM requests");
$total_orders = $stmt->fetchColumn();

// ===== TOP PRODUCTS (selected month) =====
$stmt = $pdo->prepare("
    SELECT p.name, SUM(ri.quantity) as total_qty, SUM(ri.quantity * ri.unit_price) as total_revenue
    FROM request_items ri
    JOIN products p ON ri.product_id = p.id
    JOIN requests r ON ri.request_id = r.id
    WHERE DATE_FORMAT(r.request_date, '%Y-%m') = ?
    GROUP BY ri.product_id, p.name
    ORDER BY total_qty DESC
    LIMIT 5
");
$stmt->execute([$selected_month]);
$top_products = $stmt->fetchAll();

// ===== TOP CUSTOMERS (selected month) =====
$stmt = $pdo->prepare("
    SELECT c.name, COUNT(r.id) as order_count, SUM(ri.quantity * ri.unit_price) as total_spent
    FROM customers c
    JOIN requests r ON c.id = r.customer_id
    JOIN request_items ri ON r.id = ri.request_id
    WHERE DATE_FORMAT(r.request_date, '%Y-%m') = ?
    GROUP BY c.id, c.name
    ORDER BY total_spent DESC
    LIMIT 5
");
$stmt->execute([$selected_month]);
$top_customers = $stmt->fetchAll();

// ===== MONTHLY SALES TREND (6 months up to and including selected month) =====
$trend_start = date('Y-m-d', strtotime($selected_month . '-01 -5 months'));
$stmt = $pdo->prepare("
    SELECT DATE_FORMAT(r.request_date, '%Y-%m') as month,
           SUM(ri.quantity * ri.unit_price) as revenue,
           SUM(ri.quantity) as cartons
    FROM requests r
    JOIN request_items ri ON r.id = ri.request_id
    WHERE r.request_date >= ? AND DATE_FORMAT(r.request_date, '%Y-%m') <= ?
    GROUP BY DATE_FORMAT(r.request_date, '%Y-%m')
    ORDER BY month ASC
");
$stmt->execute([$trend_start, $selected_month]);
$monthly_trend = $stmt->fetchAll();

// ===== RECENT REQUESTS (filtered by selected month) =====
$stmt = $pdo->prepare("
    SELECT r.*, c.name as customer_name, u.full_name as created_by,
           (SELECT SUM(ri.quantity * ri.unit_price) FROM request_items ri WHERE ri.request_id = r.id) as total_amount
    FROM requests r 
    JOIN customers c ON r.customer_id = c.id 
    JOIN users u ON r.user_id = u.id 
    WHERE DATE_FORMAT(r.request_date, '%Y-%m') = ?
    ORDER BY r.created_at DESC 
    LIMIT 10
");
$stmt->execute([$selected_month]);
$recent_requests = $stmt->fetchAll();

// Calculate max for chart scaling
$max_revenue = !empty($monthly_trend) ? max(array_column($monthly_trend, 'revenue')) : 1;
?>

<!-- Month Filter Bar -->
<div class="card" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem;">
    <form method="GET" style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <label style="font-weight: 600; font-size: 0.875rem; color: var(--text-muted); white-space: nowrap;">
            <i data-lucide="calendar" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"></i>
            Filter by Month:
        </label>
        <input type="month" name="month" value="<?php echo htmlspecialchars($selected_month); ?>"
               class="form-control" style="width: auto; max-width: 200px;">
        <button type="submit" class="btn btn-primary" style="white-space: nowrap;">
            <i data-lucide="search" style="width: 16px; height: 16px; margin-right: 0.25rem;"></i> View Month
        </button>
        <?php if ($selected_month !== date('Y-m')): ?>
        <a href="index.php" class="btn btn-secondary" style="white-space: nowrap;">
            <i data-lucide="rotate-ccw" style="width: 16px; height: 16px; margin-right: 0.25rem;"></i> Reset to Current
        </a>
        <?php endif; ?>
        <span style="font-size: 0.875rem; color: var(--text-muted); margin-left: auto;">
            Showing: <strong><?php echo $selected_month_label; ?></strong>
        </span>
    </form>
</div>

<!-- Welcome Section -->
<div class="welcome-section">
    <h2 class="welcome-title">Welcome back, <?php echo htmlspecialchars($_SESSION['full_name']); ?>!</h2>
    <p class="welcome-date"><?php echo date('l, F j, Y'); ?></p>
</div>

<!-- Primary Stats -->
<div class="primary-stats-grid">
    <div class="card stat-card" style="border-left: 4px solid #f59e0b;">
        <div class="stat-icon" style="background: #fef3c7; color: #f59e0b;">
            <i data-lucide="clock" style="width: 24px; height: 24px;"></i>
        </div>
        <div class="stat-content">
            <div class="stat-value"><?php echo $pending_requests; ?></div>
            <div class="stat-label">Pending</div>
        </div>
    </div>
    <div class="card stat-card" style="border-left: 4px solid #10b981;">
        <div class="stat-icon" style="background: #d1fae5; color: #10b981;">
            <i data-lucide="check-circle" style="width: 24px; height: 24px;"></i>
        </div>
        <div class="stat-content">
            <div class="stat-value"><?php echo $approved_requests; ?></div>
            <div class="stat-label">Approved</div>
        </div>
    </div>
    <div class="card stat-card" style="border-left: 4px solid #6366f1;">
        <div class="stat-icon" style="background: #e0e7ff; color: #6366f1;">
            <i data-lucide="users" style="width: 24px; height: 24px;"></i>
        </div>
        <div class="stat-content">
            <div class="stat-value"><?php echo $total_customers; ?></div>
            <div class="stat-label">Customers</div>
        </div>
    </div>
    <div class="card stat-card" style="border-left: 4px solid #ec4899;">
        <div class="stat-icon" style="background: #fce7f3; color: #ec4899;">
            <i data-lucide="package" style="width: 24px; height: 24px;"></i>
        </div>
        <div class="stat-content">
            <div class="stat-value"><?php echo $total_products; ?></div>
            <div class="stat-label">Products</div>
        </div>
    </div>
</div>

<!-- Revenue Stats -->
<div class="revenue-stats-grid">
    <div class="card" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <div style="font-size: 0.875rem; opacity: 0.9;">Total Revenue</div>
                <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem;"><?php echo number_format($total_revenue, 0); ?></div>
                <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">TZS (All Time)</div>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 0.5rem;">
                <i data-lucide="trending-up" style="width: 24px; height: 24px;"></i>
            </div>
        </div>
    </div>
    <div class="card" style="background: linear-gradient(135deg, #10b981, #34d399); color: white;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <div style="font-size: 0.875rem; opacity: 0.9;"><?php echo $selected_month_label; ?></div>
                <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem;"><?php echo number_format($monthly_revenue, 0); ?></div>
                <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">TZS Revenue</div>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 0.5rem;">
                <i data-lucide="calendar" style="width: 24px; height: 24px;"></i>
            </div>
        </div>
    </div>
    <div class="card" style="background: linear-gradient(135deg, #f59e0b, #fbbf24); color: white;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <div style="font-size: 0.875rem; opacity: 0.9;">Cartons Sold</div>
                <div style="font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem;"><?php echo number_format($total_cartons); ?></div>
                <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;"><?php echo number_format($monthly_cartons); ?> in <?php echo $selected_month_label; ?></div>
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 0.75rem; border-radius: 0.5rem;">
                <i data-lucide="box" style="width: 24px; height: 24px;"></i>
            </div>
        </div>
    </div>
</div>

<!-- Charts Row -->
<div class="dashboard-grid" style="margin-bottom: 1.5rem;">
    <!-- Monthly Trend Chart -->
    <div class="card">
        <h3 class="card-title">Sales Trend (Last 6 Months)</h3>
        <?php if (empty($monthly_trend)): ?>
            <p style="color: var(--text-muted); text-align: center; padding: 2rem;">No sales data yet</p>
        <?php else: ?>
            <div class="chart-container">
                <?php foreach ($monthly_trend as $month): ?>
                    <?php $percentage = ($month['revenue'] / $max_revenue) * 100; ?>
                    <div class="chart-bar-group">
                        <div class="chart-bar" style="height: <?php echo max(5, $percentage); ?>%;">
                            <span class="chart-tooltip"><?php echo number_format($month['revenue'], 0); ?> TZS</span>
                        </div>
                        <div class="chart-label"><?php echo date('M', strtotime($month['month'] . '-01')); ?></div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <!-- Top Products -->
    <div class="card">
        <h3 class="card-title">Top Products</h3>
        <?php if (empty($top_products)): ?>
            <p style="color: var(--text-muted); text-align: center; padding: 2rem;">No products sold yet</p>
        <?php else: ?>
            <div class="ranking-list">
                <?php foreach ($top_products as $i => $product): ?>
                <div class="ranking-item">
                    <div class="ranking-position"><?php echo $i + 1; ?></div>
                    <div class="ranking-info">
                        <div class="ranking-name"><?php echo htmlspecialchars($product['name']); ?></div>
                        <div class="ranking-stats"><?php echo number_format($product['total_qty']); ?> cartons</div>
                    </div>
                    <div class="ranking-value"><?php echo number_format($product['total_revenue'], 0); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>
</div>

<!-- Second Row -->
<div class="dashboard-grid" style="margin-bottom: 1.5rem;">
    <!-- Top Customers -->
    <div class="card">
        <h3 class="card-title">Top Customers</h3>
        <?php if (empty($top_customers)): ?>
            <p style="color: var(--text-muted); text-align: center; padding: 2rem;">No customer data yet</p>
        <?php else: ?>
            <div class="ranking-list">
                <?php foreach ($top_customers as $i => $customer): ?>
                <div class="ranking-item">
                    <div class="ranking-position" style="background: linear-gradient(135deg, #10b981, #34d399);"><?php echo $i + 1; ?></div>
                    <div class="ranking-info">
                        <div class="ranking-name"><?php echo htmlspecialchars($customer['name']); ?></div>
                        <div class="ranking-stats"><?php echo $customer['order_count']; ?> orders</div>
                    </div>
                    <div class="ranking-value"><?php echo number_format($customer['total_spent'], 0); ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <!-- Quick Actions -->
    <div class="card">
        <h3 class="card-title">Quick Actions</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <a href="create_request.php" class="quick-action-btn" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);">
                <i data-lucide="plus-circle" style="width: 24px; height: 24px;"></i>
                <span>New Request</span>
            </a>
            <a href="customers.php" class="quick-action-btn" style="background: linear-gradient(135deg, #10b981, #34d399);">
                <i data-lucide="users" style="width: 24px; height: 24px;"></i>
                <span>Customers</span>
            </a>
            <a href="products.php" class="quick-action-btn" style="background: linear-gradient(135deg, #f59e0b, #fbbf24);">
                <i data-lucide="package" style="width: 24px; height: 24px;"></i>
                <span>Products</span>
            </a>
            <a href="requests.php" class="quick-action-btn" style="background: linear-gradient(135deg, #ec4899, #f472b6);">
                <i data-lucide="file-text" style="width: 24px; height: 24px;"></i>
                <span>All Requests</span>
            </a>
        </div>
    </div>
</div>

<!-- Recent Requests -->
<div class="card">
    <div class="flex-header">
        <h3 class="card-title" style="margin-bottom: 0;">Requests — <?php echo $selected_month_label; ?></h3>
        <a href="requests.php" class="btn btn-secondary btn-sm">View All</a>
    </div>
    
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th style="text-align: right;">Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($recent_requests as $request): ?>
                <tr>
                    <td data-label="ID">#<?php echo str_pad($request['id'], 4, '0', STR_PAD_LEFT); ?></td>
                    <td data-label="Date"><?php echo date('d M Y', strtotime($request['request_date'])); ?></td>
                    <td data-label="Customer" style="font-weight: 500;"><?php echo htmlspecialchars($request['customer_name']); ?></td>
                    <td data-label="Route"><?php echo htmlspecialchars($request['route'] ?? '—'); ?></td>
                    <td data-label="Amount" style="text-align: right;"><?php echo number_format($request['total_amount'] ?? 0, 0); ?> TZS</td>
                    <td data-label="Status">
                        <?php
                        $statusClass = match($request['status']) {
                            'approved' => 'badge-success',
                            'pending' => 'badge-warning',
                            'rejected' => 'badge-danger',
                            default => 'badge-secondary'
                        };
                        ?>
                        <span class="badge <?php echo $statusClass; ?>"><?php echo ucfirst($request['status']); ?></span>
                    </td>
                    <td data-label="Action">
                        <a href="view_request.php?id=<?php echo $request['id']; ?>" class="btn btn-secondary btn-sm">
                            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View
                        </a>
                    </td>
                </tr>
                <?php endforeach; ?>
                <?php if (empty($recent_requests)): ?>
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No requests found</td>
                </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
