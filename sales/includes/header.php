<?php
require_once __DIR__ . '/../config.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Check authentication
if (!isset($_SESSION['user_id']) && basename($_SERVER['PHP_SELF']) != 'login.php') {
    header("Location: login.php");
    exit;
}

$user_role = $_SESSION['role'] ?? 'guest';
$user_name = $_SESSION['full_name'] ?? 'Guest';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($pageTitle) ? $pageTitle . ' - Sales System' : 'Sales System'; ?></title>
    <link rel="stylesheet" href="assets/css/style.css?v=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <!-- Icons (using Lucide icons) -->
    <script src="https://unpkg.com/lucide@latest" defer></script>
</head>
<body>

<?php if (basename($_SERVER['PHP_SELF']) != 'login.php'): ?>
<div class="app-container">
    <div id="sidebar-overlay" class="sidebar-overlay"></div>
    <!-- Sidebar -->
    <aside class="sidebar">
        <div class="sidebar-header">
            EAST AFRICAN SPIRIT
            <button id="sidebar-close" class="sidebar-close-btn">
                <i data-lucide="x"></i>
            </button>
        </div>
        <nav class="sidebar-nav">
            <a href="index.php" class="nav-item <?php echo basename($_SERVER['PHP_SELF']) == 'index.php' ? 'active' : ''; ?>">
                <i data-lucide="layout-dashboard" class="nav-icon"></i> Dashboard
            </a>
            <a href="create_request.php" class="nav-item <?php echo basename($_SERVER['PHP_SELF']) == 'create_request.php' ? 'active' : ''; ?>">
                <i data-lucide="file-plus" class="nav-icon"></i> New Request
            </a>
            <a href="requests.php" class="nav-item <?php echo basename($_SERVER['PHP_SELF']) == 'requests.php' ? 'active' : ''; ?>">
                <i data-lucide="file-text" class="nav-icon"></i> All Requests
            </a>
            <a href="customers.php" class="nav-item <?php echo basename($_SERVER['PHP_SELF']) == 'customers.php' ? 'active' : ''; ?>">
                <i data-lucide="users" class="nav-icon"></i> Customers
            </a>
            <a href="products.php" class="nav-item <?php echo basename($_SERVER['PHP_SELF']) == 'products.php' ? 'active' : ''; ?>">
                <i data-lucide="package" class="nav-icon"></i> Products
            </a>
            <?php if ($user_role === 'admin'): ?>
            <a href="admin.php" class="nav-item <?php echo basename($_SERVER['PHP_SELF']) == 'admin.php' ? 'active' : ''; ?>">
                <i data-lucide="settings" class="nav-icon"></i> Admin Panel
            </a>
            <?php endif; ?>
        </nav>
        <div style="padding: 1rem; border-top: 1px solid #374151;">
            <a href="logout.php" class="nav-item" style="color: #ef4444;">
                <i data-lucide="log-out" class="nav-icon"></i> Logout
            </a>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
        <header class="top-header glass">
            <!-- Mobile Menu Button -->
            <button id="sidebar-toggle" class="btn btn-secondary mobile-menu-btn">
                <i data-lucide="menu"></i>
            </button>
            <h2 style="font-size: 1.25rem; font-weight: 600;"><?php echo $pageTitle ?? 'Dashboard'; ?></h2>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="text-align: right;">
                    <div style="font-weight: 600; font-size: 0.875rem;"><?php echo htmlspecialchars($user_name); ?></div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: capitalize;"><?php echo htmlspecialchars($user_role); ?></div>
                </div>
                <div style="width: 40px; height: 40px; background: #e0e7ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary-color); font-weight: 700;">
                    <?php echo strtoupper(substr($user_name, 0, 1)); ?>
                </div>
            </div>
        </header>
        <div class="page-content">
<?php endif; ?>
