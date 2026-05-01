<?php
$pageTitle = 'View Request';
require_once 'includes/header.php';

if (!isset($_GET['id'])) {
    header("Location: requests.php");
    exit;
}

$request_id = (int)$_GET['id'];

// Fetch Request Details with customer export status
try {
    $stmt = $pdo->prepare("
        SELECT r.*, c.name as customer_name, c.location, c.phone, 
               IFNULL(c.is_export, 0) as is_export,
               IFNULL(c.charges_efd, 0) as charges_efd,
               IFNULL(c.efd_profit_per_carton, 2000) as efd_profit_per_carton,
               u.full_name as prepared_by_name
        FROM requests r 
        JOIN customers c ON r.customer_id = c.id 
        JOIN users u ON r.user_id = u.id 
        WHERE r.id = ?
    ");
    $stmt->execute([$request_id]);
    $request = $stmt->fetch();
} catch (PDOException $e) {
    // Fallback
    $stmt = $pdo->prepare("
        SELECT r.*, c.name as customer_name, c.location, c.phone, 
               0 as is_export, 0 as charges_efd, 2000 as efd_profit_per_carton,
               u.full_name as prepared_by_name
        FROM requests r 
        JOIN customers c ON r.customer_id = c.id 
        JOIN users u ON r.user_id = u.id 
        WHERE r.id = ?
    ");
    $stmt->execute([$request_id]);
    $request = $stmt->fetch();
}

if (!$request) {
    die("Request not found");
}

$is_export = $request['is_export'] ?? 0;
$charges_efd = $request['charges_efd'] ?? 0;
$efd_profit_per_carton = floatval($request['efd_profit_per_carton'] ?? 2000);
$efd_rate = 0.18; // 18% of profit per carton

// Fetch Items - try with carton_weight, fallback without
try {
    $stmt = $pdo->prepare("
        SELECT ri.*, p.name as product_name, IFNULL(p.carton_weight, 0) as carton_weight
        FROM request_items ri 
        JOIN products p ON ri.product_id = p.id 
        WHERE ri.request_id = ?
    ");
    $stmt->execute([$request_id]);
    $items = $stmt->fetchAll();
} catch (PDOException $e) {
    // If carton_weight column doesn't exist, query without it
    $stmt = $pdo->prepare("
        SELECT ri.*, p.name as product_name, 0 as carton_weight
        FROM request_items ri 
        JOIN products p ON ri.product_id = p.id 
        WHERE ri.request_id = ?
    ");
    $stmt->execute([$request_id]);
    $items = $stmt->fetchAll();
}

// Fetch Signatures
$stmt = $pdo->prepare("
    SELECT rs.*, u.full_name, u.role 
    FROM request_signatures rs 
    JOIN users u ON rs.signer_id = u.id 
    WHERE rs.request_id = ?
");
$stmt->execute([$request_id]);
$raw_signatures = $stmt->fetchAll();
$sigs = [];
foreach($raw_signatures as $s) {
    $sigs[$s['signature_type']] = $s;
}

// Calculate Totals - compute on the fly
$subtotal = 0;
$total_weight = 0;
foreach ($items as &$item) {
    // Recalculate total_price on the fly (qty * unit_price)
    $item['calculated_total'] = $item['quantity'] * $item['unit_price'];
    $subtotal += $item['calculated_total'];
    $total_weight += ($item['carton_weight'] ?? 0) * $item['quantity'];
}
unset($item); // Break reference

// Calculate VAT based on customer type
$vat_rate = 18; // 18% VAT
if ($is_export) {
    // Export customers: No VAT charged
    $vat_amount = 0;
    $grand_total = $subtotal;
} else {
    // Local customers: Prices are VAT Inclusive
    // Subtotal = Line Totals / 1.18 (VAT exclusive)
    $line_totals = $subtotal; // Save original line totals
    $subtotal = $line_totals / 1.18; // VAT exclusive subtotal
    $vat_amount = $subtotal * 0.18; // VAT is 18% of VAT exclusive subtotal
    $grand_total = $line_totals; // Grand total equals original line totals (VAT inclusive)
}

// EFD Charge Calculation: 18% of profit_per_carton × total cartons dispatched
$total_cartons_all = 0;
foreach ($items as $item) {
    $total_cartons_all += $item['quantity'];
}
$efd_charge_per_carton = $efd_profit_per_carton * $efd_rate; // e.g. 2000 * 0.18 = 360
$efd_charge_total = $charges_efd ? ($efd_charge_per_carton * $total_cartons_all) : 0;
$grand_total_with_efd = $grand_total + $efd_charge_total;


?>

<div class="no-print" style="margin-bottom: 1rem; display: flex; gap: 1rem; justify-content: space-between; align-items: center;">
    <a href="requests.php" class="btn btn-secondary">
        <i data-lucide="arrow-left" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i> Back to Requests
    </a>
    <div style="display: flex; gap: 1rem;">
        <a href="download_request.php?id=<?php echo $request['id']; ?>" target="_blank" class="btn btn-secondary">
            <i data-lucide="download" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i> Download PDF
        </a>
        <button onclick="window.print()" class="btn btn-secondary">
            <i data-lucide="printer" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i> Print
        </button>
        
        <?php if ($request['status'] == 'pending' && $_SESSION['role'] == 'accountant' && !isset($sigs['approved_by'])): ?>
            <form method="POST" action="sign_request.php">
                <input type="hidden" name="request_id" value="<?php echo $request['id']; ?>">
                <input type="hidden" name="action" value="approve">
                <button type="submit" class="btn btn-success">
                    <i data-lucide="check-circle" style="width: 16px; height: 16px; margin-right: 0.5rem;"></i> Approve
                </button>
            </form>
        <?php endif; ?>
    </div>
</div>

<div class="card print-page" style="max-width: 800px; margin: 0 auto; border: 1px solid #000;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 1rem;">
        <h1 style="font-size: 1.25rem; font-weight: 800; color: #000; text-transform: uppercase; margin-bottom: 0.25rem;">East African Spirit (T) Ltd.</h1>
        <p style="font-weight: 600; font-size: 0.875rem; margin: 0;">P.O.BOX 707 SHINYANGA</p>
    </div>

    <div class="document-header" style="font-size: 0.8rem; margin-bottom: 0.75rem;">
        <div>
            <div><strong>Customer:</strong> <?php echo strtoupper($request['customer_name']); ?></div>
            <div><strong>Truck No:</strong> <?php echo strtoupper($request['truck_no']); ?></div>
            <div><strong>Driver:</strong> <?php echo strtoupper($request['driver_name']); ?></div>
        </div>
        <div style="text-align: right;">
            <div><strong>Date:</strong> <?php echo date('d.m.Y', strtotime($request['request_date'])); ?></div>
            <div><strong>Route:</strong> <?php echo strtoupper($request['route']); ?></div>
            <div><strong>Ref:</strong> #<?php echo str_pad($request['id'], 4, '0', STR_PAD_LEFT); ?></div>
        </div>
    </div>

    <h2 style="text-align: center; font-size: 0.95rem; font-weight: 700; text-decoration: underline; margin: 0.75rem 0;">REQUEST NOTE FOR CARTONS</h2>

    <div class="table-container">
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 0.75rem;">
        <thead>
            <tr style="border-bottom: 1px solid #000; background: #f5f5f5;">
                <th style="border: 1px solid #000; padding: 0.3rem; width: 30px;">S/N</th>
                <th style="border: 1px solid #000; padding: 0.3rem; text-align: left;">Product Name</th>
                <th style="border: 1px solid #000; padding: 0.3rem; width: 55px;">Qty</th>
                <th style="border: 1px solid #000; padding: 0.3rem; width: 70px;">Price@</th>
                <th style="border: 1px solid #000; padding: 0.3rem; width: 80px;">Total</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($items as $index => $item): ?>
            <tr>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: center;"><?php echo $index + 1; ?></td>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 600;"><?php echo strtoupper($item['product_name']); ?></td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: center;"><?php echo $item['quantity']; ?></td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right;"><?php echo number_format($item['unit_price'], 2); ?></td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right;"><?php echo number_format($item['calculated_total'], 2); ?></td>
            </tr>
            <?php endforeach; ?>
            
            <!-- Only show empty rows if less than 3 items to save space -->
            <?php $empty_rows = max(0, 3 - count($items)); ?>
            <?php for($i = 0; $i < $empty_rows; $i++): ?>
            <tr>
                <td style="border: 1px solid #000; padding: 0.3rem;">&nbsp;</td>
                <td style="border: 1px solid #000; padding: 0.3rem;">&nbsp;</td>
                <td style="border: 1px solid #000; padding: 0.3rem;">&nbsp;</td>
                <td style="border: 1px solid #000; padding: 0.3rem;">&nbsp;</td>
                <td style="border: 1px solid #000; padding: 0.3rem;">&nbsp;</td>
            </tr>
            <?php endfor; ?>

            <!-- Totals -->
            <?php if ($is_export): ?>
            <!-- Export Customer: VAT Exclusive (no VAT charged) -->
            <tr>
                <td colspan="3" rowspan="2" style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 700; font-size: 0.7rem;">SUBTOTAL</td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right; font-weight: 700;"><?php echo number_format($subtotal, 2); ?></td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 700; font-size: 0.7rem; background: #f0f0f0;">GRAND TOTAL</td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right; font-weight: 700; background: #f0f0f0;"><?php echo number_format($grand_total, 2); ?></td>
            </tr>
            <?php else: ?>
            <!-- Local Customer: VAT Inclusive -->
            <tr>
                <td colspan="3" rowspan="<?php echo $charges_efd ? 4 : 3; ?>" style="border: 1px solid #000;"></td>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 700; font-size: 0.7rem;">SUBTOTAL</td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right; font-weight: 700;"><?php echo number_format($subtotal, 2); ?></td>
            </tr>
            <tr>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 700; font-size: 0.7rem; background: #dbeafe;">VAT (18%)</td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right; font-weight: 700; background: #dbeafe;"><?php echo number_format($vat_amount, 2); ?></td>
            </tr>
            <?php if ($charges_efd): ?>
            <tr>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 700; font-size: 0.7rem; background: #fff7ed;">
                    EFD CHARGE (<?php echo number_format($efd_charge_per_carton, 0); ?>/ctn × <?php echo $total_cartons_all; ?> ctns)
                </td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right; font-weight: 700; background: #fff7ed;"><?php echo number_format($efd_charge_total, 2); ?></td>
            </tr>
            <?php endif; ?>
            <tr>
                <td style="border: 1px solid #000; padding: 0.3rem; font-weight: 700; font-size: 0.7rem; background: #f0f0f0;">
                    GRAND TOTAL<?php echo $charges_efd ? ' (Incl. EFD)' : ' (Incl VAT)'; ?>
                </td>
                <td style="border: 1px solid #000; padding: 0.3rem; text-align: right; font-weight: 700; background: #f0f0f0;"><?php echo number_format($grand_total_with_efd, 2); ?></td>
            </tr>
            <?php endif; ?>
        </tbody>
    </table>
    </div>

    <!-- Cartons Weight Section -->
    <div style="margin-top: 1rem;">
        <h3 style="font-size: 0.8rem; font-weight: 700; text-align: center; background: #f0f0f0; padding: 0.3rem; border: 1px solid #000; margin-bottom: 0;">CARTONS' TOTAL WEIGHT (KGS)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
            <thead>
                <tr style="background: #f9f9f9;">
                    <th style="border: 1px solid #000; padding: 0.25rem; text-align: left;">Product</th>
                    <th style="border: 1px solid #000; padding: 0.25rem; width: 60px;">Qty</th>
                    <th style="border: 1px solid #000; padding: 0.25rem; width: 70px;">Wt/Ctn (kg)</th>
                    <th style="border: 1px solid #000; padding: 0.25rem; width: 80px;">Total (kg)</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($items as $item): ?>
                <tr>
                    <td style="border: 1px solid #000; padding: 0.25rem;"><?php echo strtoupper($item['product_name']); ?></td>
                    <td style="border: 1px solid #000; padding: 0.25rem; text-align: center;"><?php echo $item['quantity']; ?></td>
                    <td style="border: 1px solid #000; padding: 0.25rem; text-align: center;"><?php echo number_format($item['carton_weight'] ?? 0, 2); ?></td>
                    <td style="border: 1px solid #000; padding: 0.25rem; text-align: right;"><?php echo number_format(($item['carton_weight'] ?? 0) * $item['quantity'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
                <tr style="background: #f0f0f0; font-weight: 700;">
                    <td colspan="3" style="border: 1px solid #000; padding: 0.25rem; text-align: right;">TOTAL WEIGHT:</td>
                    <td style="border: 1px solid #000; padding: 0.25rem; text-align: right;"><?php echo number_format($total_weight, 2); ?> kg</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Signatures - Vertical layout (for manual signing) -->
    <div class="signatures-vertical">
        <div class="signature-row">
            <strong>Prepared by:</strong>
            <span class="signature-line-inline"></span>
        </div>
        <div class="signature-row">
            <strong>Requested by:</strong>
            <span class="signature-line-inline"></span>
        </div>
        <div class="signature-row">
            <strong>Authorised by:</strong>
            <span class="signature-line-inline"></span>
        </div>
        <div class="signature-row">
            <strong>Approved by:</strong>
            <span class="signature-line-inline"></span>
        </div>
    </div>
    
    <?php if(isset($sigs['approved_by'])): ?>
    <!-- Approval note at bottom right -->
    <div style="margin-top: 1rem; text-align: right;">
        <span style="font-size: 0.6rem; color: #666;">
            System approved by: <?php echo $sigs['approved_by']['full_name']; ?> 
            (<?php echo date('d.m.Y H:i', strtotime($sigs['approved_by']['signed_at'])); ?>)
        </span>
    </div>
    <?php endif; ?>
</div>

<?php require_once 'includes/footer.php'; ?>
