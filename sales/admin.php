<?php
$pageTitle = 'Admin Panel';

// Load config first for database connection (but don't output anything yet)
require_once __DIR__ . '/config.php';

// Start session if not started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check admin role before any output
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    // We need to include header first to show the access denied message properly
    require_once 'includes/header.php';
    echo "<div class='card'>Access Denied</div>";
    require_once 'includes/footer.php';
    exit;
}

// Handle Delete User BEFORE any output
if (isset($_GET['delete'])) {
    $id = (int)$_GET['delete'];
    if ($id != $_SESSION['user_id']) { // Prevent self-delete
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$id]);
        header("Location: admin.php?deleted=1");
        exit;
    }
}

// Handle Add User - store result in session for display after redirect
$success = '';
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add') {
    $username = $_POST['username'];
    $password = password_hash($_POST['password'], PASSWORD_DEFAULT);
    $full_name = $_POST['full_name'];
    $role = $_POST['role'];
    
    $stmt = $pdo->prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
    try {
        $stmt->execute([$username, $password, $full_name, $role]);
        $success = "User added successfully";
    } catch (PDOException $e) {
        $error = "Error adding user: " . $e->getMessage();
    }
}

// Now include header (which outputs HTML)
require_once 'includes/header.php';

// Fetch Users
$stmt = $pdo->query("SELECT * FROM users ORDER BY created_at DESC");
$users = $stmt->fetchAll();
?>

<!-- Add New User Form - Shows first on mobile -->
<div class="card card-form-mobile">
    <h3 class="card-title">Add New User</h3>
    <?php if (isset($success)): ?>
        <div class="alert alert-success"><?php echo $success; ?></div>
    <?php endif; ?>
    <?php if (isset($error)): ?>
        <div class="alert alert-danger"><?php echo $error; ?></div>
    <?php endif; ?>
    
    <form method="POST">
        <input type="hidden" name="action" value="add">
        <div class="form-grid-2">
            <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" name="full_name" class="form-control" required>
            </div>
            <div class="form-group">
                <label class="form-label">Username</label>
                <input type="text" name="username" class="form-control" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <div class="form-group">
                <label class="form-label">Role</label>
                <select name="role" class="form-control" required>
                    <option value="sales_officer">Sales Officer</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
        </div>
        <button type="submit" class="btn btn-primary btn-block">
            <i data-lucide="user-plus" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i>
            Create User
        </button>
    </form>
</div>

<!-- Users List -->
<div class="card">
    <h3 class="card-title">System Users</h3>
    
    <!-- Desktop Table View -->
    <div class="table-container desktop-only">
        <table class="table">
            <thead>
                <tr>
                    <th>Full Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user): ?>
                <tr>
                    <td><?php echo htmlspecialchars($user['full_name']); ?></td>
                    <td><?php echo htmlspecialchars($user['username']); ?></td>
                    <td><span class="badge badge-<?php echo $user['role'] === 'admin' ? 'warning' : ($user['role'] === 'accountant' ? 'success' : 'secondary'); ?>"><?php echo htmlspecialchars($user['role']); ?></span></td>
                    <td>
                        <?php if ($user['id'] != $_SESSION['user_id']): ?>
                        <a href="?delete=<?php echo $user['id']; ?>" class="btn btn-danger btn-sm" onclick="return confirm('Are you sure you want to delete this user?')">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </a>
                        <?php else: ?>
                        <span class="badge badge-secondary">You</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    
    <!-- Mobile Card View -->
    <div class="mobile-only">
        <?php foreach ($users as $user): ?>
        <div class="user-card">
            <div class="user-card-header">
                <div class="user-avatar">
                    <?php echo strtoupper(substr($user['full_name'], 0, 1)); ?>
                </div>
                <div class="user-info">
                    <div class="user-name"><?php echo htmlspecialchars($user['full_name']); ?></div>
                    <div class="user-username">@<?php echo htmlspecialchars($user['username']); ?></div>
                </div>
                <span class="badge badge-<?php echo $user['role'] === 'admin' ? 'warning' : ($user['role'] === 'accountant' ? 'success' : 'secondary'); ?>">
                    <?php echo htmlspecialchars($user['role']); ?>
                </span>
            </div>
            <?php if ($user['id'] != $_SESSION['user_id']): ?>
            <div class="user-card-actions">
                <a href="?delete=<?php echo $user['id']; ?>" class="btn btn-danger btn-sm btn-block" onclick="return confirm('Are you sure you want to delete this user?')">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px; margin-right: 0.5rem;"></i>
                    Delete User
                </a>
            </div>
            <?php endif; ?>
        </div>
        <?php endforeach; ?>
    </div>
</div>

<?php require_once 'includes/footer.php'; ?>
