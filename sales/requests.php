<?php
$pageTitle = 'All Requests';
require_once 'includes/header.php';

// Pagination
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
$per_page = 10;
$offset = ($page - 1) * $per_page;

// Fetch Requests
$stmt = $pdo->prepare("
    SELECT r.*, c.name as customer_name 
    FROM requests r 
    JOIN customers c ON r.customer_id = c.id 
    ORDER BY r.created_at DESC 
    LIMIT ? OFFSET ?
");
$stmt->bindValue(1, $per_page, PDO::PARAM_INT);
$stmt->bindValue(2, $offset, PDO::PARAM_INT);
$stmt->execute();
$requests = $stmt->fetchAll();

// Count total for pagination
$total_requests = $pdo->query("SELECT COUNT(*) FROM requests")->fetchColumn();
$total_pages = ceil($total_requests / $per_page);
?>

<div class="flex-header" style="margin-bottom: 1.5rem;">
    <div>
        <h2 style="margin: 0; font-size: 1.25rem;">All Requests</h2>
        <span style="color: var(--text-muted); font-size: 0.875rem;"><?php echo $total_requests; ?> total requests</span>
    </div>
    <a href="create_request.php" class="btn btn-primary btn-sm">
        <i data-lucide="plus" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
        New Request
    </a>
</div>

<div class="card">
    <div class="table-container">
        <table class="table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Truck</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($requests as $request): ?>
                <tr>
                    <td>#<?php echo str_pad($request['id'], 4, '0', STR_PAD_LEFT); ?></td>
                    <td><?php echo date('d.m.Y', strtotime($request['request_date'])); ?></td>
                    <td><?php echo htmlspecialchars($request['customer_name']); ?></td>
                    <td><?php echo htmlspecialchars($request['route']); ?></td>
                    <td><?php echo htmlspecialchars($request['truck_no']); ?></td>
                    <td>
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
                    <td>
                        <a href="view_request.php?id=<?php echo $request['id']; ?>" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">View</a>
                        <?php if ($_SESSION['role'] === 'admin'): ?>
                        <a href="edit_request.php?id=<?php echo $request['id']; ?>" class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</a>
                        <a href="delete_request.php?id=<?php echo $request['id']; ?>" class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="return confirm('Are you sure you want to delete this request?');">Delete</a>
                        <?php endif; ?>
                    
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    <?php if ($total_pages > 1): ?>
    <div class="pagination">
        <?php if ($page > 1): ?>
        <a href="?page=<?php echo $page - 1; ?>" class="btn btn-secondary btn-sm">
            <i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i>
        </a>
        <?php endif; ?>
        
        <?php
        // Show page numbers with ellipsis
        $start_page = max(1, $page - 2);
        $end_page = min($total_pages, $page + 2);
        
        if ($start_page > 1): ?>
            <a href="?page=1" class="btn btn-secondary btn-sm pagination-btn">1</a>
            <?php if ($start_page > 2): ?>
                <span class="pagination-ellipsis">...</span>
            <?php endif; ?>
        <?php endif; ?>
        
        <?php for ($i = $start_page; $i <= $end_page; $i++): ?>
            <a href="?page=<?php echo $i; ?>" class="btn <?php echo $i === $page ? 'btn-primary' : 'btn-secondary'; ?> btn-sm pagination-btn">
                <?php echo $i; ?>
            </a>
        <?php endfor; ?>
        
        <?php if ($end_page < $total_pages): ?>
            <?php if ($end_page < $total_pages - 1): ?>
                <span class="pagination-ellipsis">...</span>
            <?php endif; ?>
            <a href="?page=<?php echo $total_pages; ?>" class="btn btn-secondary btn-sm pagination-btn"><?php echo $total_pages; ?></a>
        <?php endif; ?>
        
        <?php if ($page < $total_pages): ?>
        <a href="?page=<?php echo $page + 1; ?>" class="btn btn-secondary btn-sm">
            <i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i>
        </a>
        <?php endif; ?>
    </div>
    <div class="pagination-info">
        Showing <?php echo $offset + 1; ?>-<?php echo min($offset + $per_page, $total_requests); ?> of <?php echo $total_requests; ?> requests
    </div>
    <?php endif; ?>
</div>

<?php require_once 'includes/footer.php'; ?>
