<?php
$pageTitle = 'Edit Request';
require_once 'includes/header.php';

// Check if user is admin
if ($_SESSION['role'] !== 'admin') {
    header("Location: requests.php");
    exit;
}

if (!isset($_GET['id'])) {
    header("Location: requests.php");
    exit;
}

$request_id = (int)$_GET['id'];

// Fetch Request Details
$stmt = $pdo->prepare("SELECT * FROM requests WHERE id = ?");
$stmt->execute([$request_id]);
$request = $stmt->fetch();

if (!$request) {
    die("Request not found");
}

// Fetch Request Items
$stmt = $pdo->prepare("
    SELECT ri.*, p.name as product_name 
    FROM request_items ri 
    JOIN products p ON ri.product_id = p.id 
    WHERE ri.request_id = ?
");
$stmt->execute([$request_id]);
$items = $stmt->fetchAll();

// Fetch customers for dropdown
try {
    $stmt = $pdo->query("SELECT *, IFNULL(is_export, 0) as is_export FROM customers ORDER BY name");
    $customers = $stmt->fetchAll();
} catch (PDOException $e) {
    $stmt = $pdo->query("SELECT *, 0 as is_export FROM customers ORDER BY name");
    $customers = $stmt->fetchAll();
}

// Fetch products
$stmt = $pdo->query("SELECT * FROM products");
$products = $stmt->fetchAll();
?>

<div class="flex-header" style="margin-bottom: 1.5rem;">
    <h2 style="margin: 0; font-size: 1.25rem;">Edit Request #<?php echo str_pad($request['id'], 4, '0', STR_PAD_LEFT); ?></h2>
    <a href="requests.php" class="btn btn-secondary btn-sm">
        <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
        Back to Requests
    </a>
</div>

<div class="card">
    <form id="editRequestForm" action="update_request.php" method="POST">
        <input type="hidden" name="request_id" value="<?php echo $request['id']; ?>">
        
        <div class="form-grid">
            <div class="form-group">
                <label class="form-label">Customer</label>
                <select name="customer_id" id="customer_id" class="form-control" required onchange="updatePrices()">
                    <option value="">Select Customer</option>
                    <?php foreach ($customers as $customer): ?>
                        <option value="<?php echo $customer['id']; ?>" 
                                data-location="<?php echo htmlspecialchars($customer['location']); ?>" 
                                data-phone="<?php echo htmlspecialchars($customer['phone']); ?>"
                                data-export="<?php echo $customer['is_export']; ?>"
                                <?php echo $customer['id'] == $request['customer_id'] ? 'selected' : ''; ?>>
                            <?php echo htmlspecialchars($customer['name']); ?>
                            <?php echo $customer['is_export'] ? ' (Export)' : ''; ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" name="request_date" class="form-control" value="<?php echo $request['request_date']; ?>" required>
            </div>
            <div class="form-group">
                <label class="form-label">Truck No</label>
                <input type="text" name="truck_no" class="form-control" value="<?php echo htmlspecialchars($request['truck_no']); ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Driver Name</label>
                <input type="text" name="driver_name" class="form-control" value="<?php echo htmlspecialchars($request['driver_name']); ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Route</label>
                <input type="text" name="route" id="route" class="form-control" value="<?php echo htmlspecialchars($request['route']); ?>">
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select name="status" class="form-control">
                    <option value="pending" <?php echo $request['status'] == 'pending' ? 'selected' : ''; ?>>Pending</option>
                    <option value="approved" <?php echo $request['status'] == 'approved' ? 'selected' : ''; ?>>Approved</option>
                    <option value="rejected" <?php echo $request['status'] == 'rejected' ? 'selected' : ''; ?>>Rejected</option>
                </select>
            </div>
        </div>

        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Request Items</h3>

        <div id="products-container">
            <!-- Product rows will be added here -->
        </div>

        <button type="button" class="btn btn-secondary" onclick="addProductRow()" style="margin-top: 1rem;">
            <i data-lucide="plus" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i> Add Product
        </button>

        <!-- Customer Type Indicator -->
        <div id="customer-type-indicator" style="display: none; padding: 0.75rem; border-radius: 0.5rem; margin: 1rem 0;"></div>

        <div class="totals-section">
            <div class="totals-card">
                <div class="total-row" style="margin-bottom: 0.5rem;">
                    <span>SUBTOTAL:</span>
                    <span id="subtotal-display">0.00</span>
                </div>
                <div class="total-row" id="vat-row" style="margin-bottom: 0.5rem; display: none;">
                    <span>VAT (18%):</span>
                    <span id="vat-display">0.00</span>
                </div>
                <div class="total-row grand-total">
                    <span id="total-label">GRAND TOTAL:</span>
                    <span id="grand-total">0.00</span>
                </div>
            </div>
        </div>

        <div style="margin-top: 2rem; text-align: right;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Update Request</button>
        </div>
    </form>
</div>

<script>
    const allProducts = <?php echo json_encode($products); ?>;
    const existingItems = <?php echo json_encode($items); ?>;
    let currentPrices = {};
    let isExportCustomer = false;

    // Initialize with default prices
    allProducts.forEach(p => {
        currentPrices[p.id] = parseFloat(p.default_price);
    });

    function updatePrices() {
        const customerId = document.getElementById('customer_id').value;
        const customerSelect = document.getElementById('customer_id');
        const selectedOption = customerSelect.options[customerSelect.selectedIndex];
        const indicator = document.getElementById('customer-type-indicator');
        
        // Check if export customer
        isExportCustomer = selectedOption.dataset.export === '1';
        
        // Show customer type indicator
        if (customerId) {
            indicator.style.display = 'block';
            if (isExportCustomer) {
                indicator.innerHTML = '<strong>🌍 Export Customer</strong> - No VAT charged';
                indicator.style.background = '#fef3c7';
                indicator.style.border = '1px solid #f59e0b';
            } else {
                indicator.innerHTML = '<strong>🏠 Local Customer</strong> - 18% VAT included';
                indicator.style.background = '#dbeafe';
                indicator.style.border = '1px solid #3b82f6';
            }
        } else {
            indicator.style.display = 'none';
        }

        if (!customerId) return;

        fetch(`get_customer_prices.php?customer_id=${customerId}`)
            .then(response => response.json())
            .then(data => {
                data.forEach(item => {
                    currentPrices[item.id] = item.price;
                });
                recalculateAll();
            });
    }

    function addProductRow(productId = '', qty = 1, price = '') {
        const container = document.getElementById('products-container');
        const index = container.children.length;
        
        const row = document.createElement('div');
        row.className = 'product-row';
        row.innerHTML = `
            <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Flavour / Product</label>
                <select name="products[${index}][id]" class="form-control product-select" onchange="updateRowPrice(this)" required>
                    <option value="">Select Product</option>
                    ${allProducts.map(p => `<option value="${p.id}" ${p.id == productId ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Quantity (ctn)</label>
                <input type="number" name="products[${index}][qty]" class="form-control qty-input" min="1" value="${qty}" oninput="calculateRowTotal(this)" required>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Price</label>
                <input type="number" name="products[${index}][price]" class="form-control price-input" step="0.01" value="${price}" readonly>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Total</label>
                <input type="number" class="form-control total-input" readonly>
            </div>
            <button type="button" class="btn btn-danger" onclick="this.parentElement.remove(); recalculateAll();" style="height: 38px;">
                <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
        `;
        
        container.appendChild(row);
        lucide.createIcons();
        
        // If product is pre-selected, update the price
        if (productId && price) {
            const priceInput = row.querySelector('.price-input');
            priceInput.value = parseFloat(price).toFixed(2);
            calculateRowTotal(row.querySelector('.qty-input'));
        } else if (productId) {
            updateRowPrice(row.querySelector('.product-select'));
        }
    }

    function updateRowPrice(select) {
        const row = select.closest('.product-row');
        const productId = select.value;
        const priceInput = row.querySelector('.price-input');
        
        if (productId && currentPrices[productId]) {
            priceInput.value = currentPrices[productId].toFixed(2);
        } else {
            priceInput.value = '';
        }
        calculateRowTotal(select);
    }

    function calculateRowTotal(element) {
        const row = element.closest('.product-row');
        const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
        const price = parseFloat(row.querySelector('.price-input').value) || 0;
        const totalInput = row.querySelector('.total-input');
        
        const total = qty * price;
        totalInput.value = total.toFixed(2);
        
        recalculateAll();
    }

    function recalculateAll() {
        let total = 0;
        document.querySelectorAll('.product-row').forEach(row => {
            const select = row.querySelector('.product-select');
            const priceInput = row.querySelector('.price-input');
            if (select.value && currentPrices[select.value]) {
                priceInput.value = currentPrices[select.value].toFixed(2);
            }
            
            const qty = parseFloat(row.querySelector('.qty-input').value) || 0;
            const price = parseFloat(row.querySelector('.price-input').value) || 0;
            const rowTotal = qty * price;
            
            row.querySelector('.total-input').value = rowTotal.toFixed(2);
            total += rowTotal;
        });

        const totalLabel = document.getElementById('total-label');
        const vatRow = document.getElementById('vat-row');
        const customerId = document.getElementById('customer_id').value;
        
        if (!customerId || isExportCustomer) {
            // Export or no customer: No VAT
            document.getElementById('subtotal-display').textContent = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            totalLabel.textContent = 'GRAND TOTAL:';
            vatRow.style.display = 'none';
            document.getElementById('grand-total').textContent = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        } else {
            // Local customer: Price is VAT Inclusive
            const vatExclusiveSubtotal = total / 1.18;
            const vatAmount = vatExclusiveSubtotal * 0.18;
            document.getElementById('subtotal-display').textContent = vatExclusiveSubtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            totalLabel.textContent = 'GRAND TOTAL (Incl VAT):';
            vatRow.style.display = 'flex';
            document.getElementById('vat-display').textContent = vatAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('grand-total').textContent = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
    }

    // Initialize with existing items
    document.addEventListener('DOMContentLoaded', () => {
        // Load existing items
        existingItems.forEach(item => {
            addProductRow(item.product_id, item.quantity, item.unit_price);
        });
        
        // If no items, add an empty row
        if (existingItems.length === 0) {
            addProductRow();
        }
        
        // Trigger price update for selected customer
        updatePrices();
    });
</script>

<?php require_once 'includes/footer.php'; ?>
