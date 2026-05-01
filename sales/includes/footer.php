<?php if (basename($_SERVER['PHP_SELF']) != 'login.php'): ?>
        </div> <!-- End page-content -->
    </main> <!-- End main-content -->
</div> <!-- End app-container -->
<?php endif; ?>

<script>
    // Initialize Lucide icons with error handling
    function initIcons() {
        try {
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            } else {
                // Retry after a short delay if lucide isn't ready
                setTimeout(initIcons, 100);
            }
        } catch (e) {
            console.warn('Lucide icons failed to initialize:', e);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIcons);
    } else {
        initIcons();
    }
</script>
<script src="assets/js/script.js?v=1"></script>
</body>
</html>
