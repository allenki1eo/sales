// Global scripts
document.addEventListener('DOMContentLoaded', () => {
    // Initialize any global UI elements if needed
    console.log('Sales System Loaded');

    // Sidebar Toggle Logic
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

    function closeSidebar() {
        if (sidebar) {
            sidebar.classList.remove('active');
        }
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    function openSidebar() {
        if (sidebar) {
            sidebar.classList.add('active');
        }
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    // Hamburger menu toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (sidebar && sidebar.classList.contains('active')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    // Close button in sidebar
    if (sidebarClose) {
        sidebarClose.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeSidebar();
        });
    }

    // Overlay click to close
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
        });
    }

    // Close sidebar when clicking a nav item (for mobile UX)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
});
