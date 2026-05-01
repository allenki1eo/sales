<?php
$pageTitle = 'Create New Request';
require_once 'includes/header.php';

// Fetch customers for dropdown (with export status and EFD flag)
try {
    $stmt = $pdo->query("SELECT *, IFNULL(is_export, 0) as is_export, IFNULL(charges_efd, 0) as charges_efd, IFNULL(efd_profit_per_carton, 2000) as efd_profit_per_carton FROM customers ORDER BY name");
    $customers = $stmt->fetchAll();
} catch (PDOException $e) {
    $stmt = $pdo->query("SELECT *, 0 as is_export, 0 as charges_efd, 2000 as efd_profit_per_carton FROM customers ORDER BY name");
    $customers = $stmt->fetchAll();
}

// Fetch products for initial JS data
$stmt = $pdo->query("SELECT * FROM products");
$products = $stmt->fetchAll();
?>

<div class="flex-header" style="margin-bottom: 1.5rem;">
    <h2 style="margin: 0; font-size: 1.25rem;">Create New Request</h2>
    <a href="requests.php" class="btn btn-secondary btn-sm">
        <i data-lucide="arrow-left" style="width: 14px; height: 14px; margin-right: 0.25rem;"></i>
        Back to Requests
    </a>
</div>

<div class="card">
    <form id="requestForm" action="process_request.php" method="POST">
        <div class="form-grid">
            <div class="form-group">
                <label class="form-label">Customer</label>

                <!-- Searchable Customer Dropdown -->
                <div id="customer-search-wrapper" style="position:relative;">
                    <!-- Hidden field submitted with the form -->
                    <input type="hidden" name="customer_id" id="customer_id" required>

                    <!-- Visible search box -->
                    <div style="position:relative;">
                        <i data-lucide="search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:#9ca3af;pointer-events:none;"></i>
                        <input type="text" id="customer-search-input" class="form-control"
                               placeholder="Type to search customer..."
                               autocomplete="off"
                               style="padding-left:34px;"
                               oninput="filterCustomers(this.value)"
                               onfocus="openCustomerDropdown()"
                               onkeydown="customerSearchKeydown(event)">
                        <button type="button" id="customer-clear-btn"
                                onclick="clearCustomerSearch()"
                                style="display:none;position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;font-size:18px;line-height:1;padding:0;">&times;</button>
                    </div>

                    <!-- Dropdown list -->
                    <div id="customer-dropdown"
                         style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;
                                background:#fff;border:1px solid #d1d5db;border-radius:8px;
                                box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:999;
                                max-height:240px;overflow-y:auto;">
                    </div>
                </div>

                <!-- All customers as JS data -->
                <script>
                const allCustomers = <?php echo json_encode(array_map(function($c) {
                    return [
                        'id'               => $c['id'],
                        'name'             => $c['name'],
                        'location'         => $c['location'] ?? '',
                        'phone'            => $c['phone'] ?? '',
                        'is_export'        => (int)$c['is_export'],
                        'charges_efd'      => (int)$c['charges_efd'],
                        'efd_profit_per_carton' => (float)$c['efd_profit_per_carton'],
                    ];
                }, $customers)); ?>;

                let customerDropdownOpen = false;
                let highlightedIndex = -1;
                let filteredCustomers = [...allCustomers];

                function buildDropdownItems(list) {
                    const dd = document.getElementById('customer-dropdown');
                    dd.innerHTML = '';
                    if (list.length === 0) {
                        dd.innerHTML = '<div style="padding:12px 14px;color:#9ca3af;font-size:0.875rem;">No customers found</div>';
                        return;
                    }
                    list.forEach((c, i) => {
                        const item = document.createElement('div');
                        item.dataset.index = i;
                        item.style.cssText = 'padding:9px 14px;cursor:pointer;font-size:0.875rem;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;';
                        const badges = [];
                        if (c.is_export) badges.push('<span style="font-size:0.65rem;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;">Export</span>');
                        if (c.charges_efd) badges.push('<span style="font-size:0.65rem;background:#fff7ed;color:#c2610f;padding:1px 5px;border-radius:3px;">EFD</span>');
                        item.innerHTML = `
                            <div>
                                <div style="font-weight:500;">${c.name}</div>
                                ${c.location ? `<div style="font-size:0.75rem;color:#9ca3af;">${c.location}</div>` : ''}
                            </div>
                            <div style="display:flex;gap:4px;">${badges.join('')}</div>`;
                        item.addEventListener('mousedown', (e) => { e.preventDefault(); selectCustomer(c); });
                        item.addEventListener('mouseenter', () => setHighlight(i));
                        dd.appendChild(item);
                    });
                    highlightedIndex = -1;
                }

                function openCustomerDropdown() {
                    filterCustomers(document.getElementById('customer-search-input').value);
                    document.getElementById('customer-dropdown').style.display = 'block';
                    customerDropdownOpen = true;
                }

                function filterCustomers(query) {
                    const q = query.trim().toLowerCase();
                    filteredCustomers = q
                        ? allCustomers.filter(c => c.name.toLowerCase().includes(q) || (c.location && c.location.toLowerCase().includes(q)))
                        : [...allCustomers];
                    buildDropdownItems(filteredCustomers);
                    document.getElementById('customer-dropdown').style.display = 'block';
                    customerDropdownOpen = true;
                }

                function selectCustomer(c) {
                    document.getElementById('customer_id').value = c.id;
                    document.getElementById('customer-search-input').value = c.name
                        + (c.is_export ? ' (Export)' : '')
                        + (c.charges_efd ? ' (EFD)' : '');
                    document.getElementById('customer-dropdown').style.display = 'none';
                    document.getElementById('customer-clear-btn').style.display = 'block';
                    customerDropdownOpen = false;
                    // Build a synthetic option-like object so updatePrices() can read data attributes
                    const syntheticOption = {
                        value: c.id,
                        dataset: {
                            location: c.location,
                            phone: c.phone,
                            export: String(c.is_export),
                            efd: String(c.charges_efd),
                            efdProfit: String(c.efd_profit_per_carton)
                        }
                    };
                    // Call updatePrices with the synthetic object
                    updatePricesFromOption(syntheticOption);
                }

                function clearCustomerSearch() {
                    document.getElementById('customer_id').value = '';
                    document.getElementById('customer-search-input').value = '';
                    document.getElementById('customer-clear-btn').style.display = 'none';
                    document.getElementById('customer-type-indicator').style.display = 'none';
                    document.getElementById('customer-dropdown').style.display = 'none';
                    isExportCustomer = false;
                    isEfdCustomer = false;
                    recalculateAll();
                }

                function setHighlight(i) {
                    const items = document.querySelectorAll('#customer-dropdown > div[data-index]');
                    items.forEach(el => el.style.background = '');
                    if (i >= 0 && items[i]) {
                        items[i].style.background = '#f0f9ff';
                        highlightedIndex = i;
                    }
                }

                function customerSearchKeydown(e) {
                    const items = document.querySelectorAll('#customer-dropdown > div[data-index]');
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlight(Math.min(highlightedIndex + 1, items.length - 1));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlight(Math.max(highlightedIndex - 1, 0));
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (highlightedIndex >= 0 && filteredCustomers[highlightedIndex]) {
                            selectCustomer(filteredCustomers[highlightedIndex]);
                        }
                    } else if (e.key === 'Escape') {
                        document.getElementById('customer-dropdown').style.display = 'none';
                        customerDropdownOpen = false;
                    }
                }

                // Close dropdown when clicking anywhere else
                document.addEventListener('click', function(e) {
                    if (!document.getElementById('customer-search-wrapper').contains(e.target)) {
                        document.getElementById('customer-dropdown').style.display = 'none';
                        customerDropdownOpen = false;
                    }
                });
                </script>
            </div>
            <div class="form-group">
                <label class="form-label">Date</label>
                <input type="date" name="request_date" class="form-control" value="<?php echo date('Y-m-d'); ?>" required>
            </div>
            <div class="form-group">
                <label class="form-label">Truck No</label>
                <input type="text" name="truck_no" class="form-control" placeholder="T 722EDT">
            </div>
            <div class="form-group">
                <label class="form-label">Driver Name</label>
                <input type="text" name="driver_name" class="form-control">
            </div>
            <div class="form-group">
                <label class="form-label">Route</label>
                <input type="text" name="route" id="route" class="form-control">
            </div>
            <div class="form-group">
                <label class="form-label">Sales Officer</label>
                <input type="text" class="form-control" value="<?php echo htmlspecialchars($_SESSION['full_name']); ?>" readonly>
            </div>
        </div>

        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Request Note for Cartons</h3>

        <div id="products-container">
            <!-- Product rows will be added here -->
        </div>

        <button type="button" class="btn btn-secondary" onclick="addProductRow()" style="margin-top: 1rem;">
            <i data-lucide="plus" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i> Add Product
        </button>

        <!-- Customer Type Indicator -->
        <div id="customer-type-indicator" style="display: none; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 1rem;">
        </div>
        <input type="hidden" name="is_export" id="is_export" value="0">

        <div class="totals-section">
            <div class="totals-card">
                <!-- Line Total row (sum of qty × price, VAT inclusive for local customers) -->
                <div class="total-row" style="margin-bottom: 0.5rem;">
                    <span>LINE TOTAL:</span>
                    <span id="line-total-display">0.00</span>
                </div>
                <!-- Subtotal (excl. VAT) — only shown for local customers -->
                <div class="total-row" id="subtotal-row" style="margin-bottom: 0.5rem; display: none; color: var(--text-muted); font-size: 0.85rem;">
                    <span>Subtotal (excl. VAT):</span>
                    <span id="subtotal-display">0.00</span>
                </div>
                <!-- VAT row — only shown for local customers -->
                <div class="total-row" id="vat-row" style="margin-bottom: 0.5rem; display: none; color: #2563eb; font-weight: 600;">
                    <span>VAT (18%):</span>
                    <span id="vat-display">0.00</span>
                </div>
                <!-- EFD Charge row — only shown for EFD customers -->
                <div class="total-row" id="efd-row" style="margin-bottom: 0.5rem; display: none; color: #c2610f; font-weight: 600;">
                    <span id="efd-label">EFD CHARGE:</span>
                    <span id="efd-display">0.00</span>
                </div>
                <!-- Grand Total -->
                <div class="total-row grand-total">
                    <span id="total-label">GRAND TOTAL:</span>
                    <span id="grand-total">0.00</span>
                </div>
                <div id="vat-note" style="font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 0.5rem;">
                    Select a customer to see VAT status
                </div>
            </div>
        </div>

        <div style="margin-top: 2rem; text-align: right;">
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 2rem;">Create Request</button>
        </div>
    </form>
</div>

<script>
    const allProducts = <?php echo json_encode($products); ?>;
    let currentPrices = {};
    let isExportCustomer = false;
    let isEfdCustomer = false;
    let efdProfitPerCarton = 2000;

    // Initialize with default prices
    allProducts.forEach(p => {
        currentPrices[p.id] = parseFloat(p.default_price);
    });

    // Called by the searchable dropdown after a customer is selected
    function updatePricesFromOption(selectedOption) {
        const customerId = selectedOption.value;
        const indicator = document.getElementById('customer-type-indicator');
        
        // Check if export customer
        isExportCustomer = selectedOption.dataset.export === '1';
        document.getElementById('is_export').value = isExportCustomer ? '1' : '0';

        // Check if EFD customer
        isEfdCustomer = selectedOption.dataset.efd === '1';
        efdProfitPerCarton = parseFloat(selectedOption.dataset.efdProfit) || 2000;
        
        // Show customer type indicator
        if (customerId) {
            indicator.style.display = 'block';
            if (isExportCustomer) {
                indicator.innerHTML = '<strong>🌍 Export Customer</strong> - No VAT charged';
                indicator.style.background = '#fef3c7';
                indicator.style.border = '1px solid #f59e0b';
            } else if (isEfdCustomer) {
                indicator.innerHTML = `<strong>🧾 EFD Machine Customer</strong> — VAT + EFD charge (${(efdProfitPerCarton * 0.18).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})} TZS/ctn) will be added`;
                indicator.style.background = '#fff7ed';
                indicator.style.border = '1px solid #f97316';
            } else {
                indicator.innerHTML = '<strong>🏠 Local Customer</strong> - 18% VAT will be added';
                indicator.style.background = '#dbeafe';
                indicator.style.border = '1px solid #3b82f6';
            }
        } else {
            indicator.style.display = 'none';
        }
        
        // Auto-fill route/location if available
        if (selectedOption.dataset.location) {
            document.getElementById('route').value = selectedOption.dataset.location;
        }

        if (!customerId) return;

        fetch(`get_customer_prices.php?customer_id=${customerId}`)
            .then(response => response.json())
            .then(data => {
                data.forEach(item => {
                    currentPrices[item.id] = item.price;
                });
                // Update existing rows
                recalculateAll();
            });
    }

    function addProductRow() {
        const container = document.getElementById('products-container');
        const index = container.children.length;
        
        const row = document.createElement('div');
        row.className = 'product-row';
        row.innerHTML = `
            <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Flavour / Product</label>
                <select name="products[${index}][id]" class="form-control product-select" onchange="updateRowPrice(this)" required>
                    <option value="">Select Product</option>
                    ${allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Quantity (ctn)</label>
                <input type="number" name="products[${index}][qty]" class="form-control qty-input" min="1" value="1" oninput="calculateRowTotal(this)" required>
            </div>
            <div class="form-group" style="margin-bottom: 0; position: relative;">
                <label class="form-label" style="display:flex; align-items:center; gap:0.4rem;">
                    Price
                    <span class="price-edited-badge" style="display:none; font-size:0.65rem; background:#f97316; color:#fff; padding:1px 6px; border-radius:4px; cursor:pointer; font-weight:600;" title="Click to reset to default price">CUSTOM ↺</span>
                </label>
                <input type="number" name="products[${index}][price]" class="form-control price-input" step="0.01"
                       oninput="onPriceEdit(this)">
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
    }

    function updateRowPrice(select) {
        const row = select.closest('.product-row');
        const productId = select.value;
        const priceInput = row.querySelector('.price-input');
        const badge = row.querySelector('.price-edited-badge');
        
        if (productId && currentPrices[productId]) {
            const defaultPrice = currentPrices[productId];
            priceInput.value = defaultPrice.toFixed(2);
            // Store the default price on the element for reset
            priceInput.dataset.defaultPrice = defaultPrice;
            if (badge) badge.style.display = 'none';
        } else {
            priceInput.value = '';
            priceInput.dataset.defaultPrice = '';
            if (badge) badge.style.display = 'none';
        }
        calculateRowTotal(select);
    }

    function onPriceEdit(priceInput) {
        const row = priceInput.closest('.product-row');
        const badge = row.querySelector('.price-edited-badge');
        const defaultPrice = parseFloat(priceInput.dataset.defaultPrice) || 0;
        const currentPrice = parseFloat(priceInput.value) || 0;

        if (badge) {
            // Show badge when price differs from default
            if (defaultPrice > 0 && Math.abs(currentPrice - defaultPrice) > 0.01) {
                badge.style.display = 'inline';
                // Click badge to reset
                badge.onclick = () => {
                    priceInput.value = defaultPrice.toFixed(2);
                    badge.style.display = 'none';
                    calculateRowTotal(priceInput);
                };
            } else {
                badge.style.display = 'none';
            }
        }
        calculateRowTotal(priceInput);
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
        let lineTotal = 0;
        let totalCartons = 0;
        document.querySelectorAll('.product-row').forEach(row => {
            // Only auto-update price if the user has NOT manually edited it
            const select = row.querySelector('.product-select');
            const priceInput = row.querySelector('.price-input');
            const badge = row.querySelector('.price-edited-badge');
            const isCustomPrice = badge && badge.style.display !== 'none';
            if (!isCustomPrice && select.value && currentPrices[select.value]) {
                priceInput.value = currentPrices[select.value].toFixed(2);
                priceInput.dataset.defaultPrice = currentPrices[select.value];
            }
            
            const qty   = parseFloat(row.querySelector('.qty-input').value) || 0;
            const price = parseFloat(row.querySelector('.price-input').value) || 0;
            const rowTotal = qty * price;
            
            row.querySelector('.total-input').value = rowTotal.toFixed(2);
            lineTotal += rowTotal;
            totalCartons += qty;
        });

        const fmt = v => v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

        const totalLabel   = document.getElementById('total-label');
        const vatNote      = document.getElementById('vat-note');
        const vatRow       = document.getElementById('vat-row');
        const subtotalRow  = document.getElementById('subtotal-row');
        const efdRow       = document.getElementById('efd-row');
        const customerId   = document.getElementById('customer_id').value;

        // Always show line total
        document.getElementById('line-total-display').textContent = fmt(lineTotal);

        if (!customerId) {
            // No customer selected
            totalLabel.textContent = 'GRAND TOTAL:';
            vatNote.textContent = 'Select a customer to see VAT status';
            vatRow.style.display = 'none';
            subtotalRow.style.display = 'none';
            efdRow.style.display = 'none';
            document.getElementById('grand-total').textContent = fmt(lineTotal);

        } else if (isExportCustomer) {
            // Export customer: No VAT — line total IS grand total
            totalLabel.textContent = 'GRAND TOTAL:';
            vatNote.textContent = '🌍 Export – No VAT charged';
            vatRow.style.display = 'none';
            subtotalRow.style.display = 'none';
            efdRow.style.display = 'none';
            document.getElementById('grand-total').textContent = fmt(lineTotal);

        } else {
            // Local customer (with or without EFD): prices are VAT-inclusive
            // lineTotal  = VAT-inclusive amount
            // subtotal   = lineTotal / 1.18  (VAT-exclusive)
            // vatAmount  = subtotal * 0.18
            const subtotal  = lineTotal / 1.18;
            const vatAmount = subtotal * 0.18;

            document.getElementById('subtotal-display').textContent = fmt(subtotal);
            document.getElementById('vat-display').textContent = fmt(vatAmount);

            subtotalRow.style.display = 'flex';
            vatRow.style.display = 'flex';
            totalLabel.textContent = 'GRAND TOTAL (Incl. VAT):';
            vatNote.textContent = '🏠 Local – Prices are VAT-inclusive';

            // EFD Charge: 18% × profit_per_carton × total cartons
            if (isEfdCustomer && totalCartons > 0) {
                const efdChargePerCtn = efdProfitPerCarton * 0.18;
                const efdTotal = efdChargePerCtn * totalCartons;
                document.getElementById('efd-label').textContent =
                    `EFD CHARGE (${efdChargePerCtn.toLocaleString('en-US', {maximumFractionDigits: 0})}/ctn × ${totalCartons} ctns):`;
                document.getElementById('efd-display').textContent = fmt(efdTotal);
                document.getElementById('grand-total').textContent = fmt(lineTotal + efdTotal);
                totalLabel.textContent = 'GRAND TOTAL (Incl. VAT + EFD):';
                efdRow.style.display = 'flex';
            } else {
                efdRow.style.display = 'none';
                document.getElementById('grand-total').textContent = fmt(lineTotal);
            }
        }
    }

    // Add one row by default
    document.addEventListener('DOMContentLoaded', () => {
        addProductRow();
    });
</script>

<?php require_once 'includes/footer.php'; ?>
