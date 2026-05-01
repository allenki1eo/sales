<?php
require_once __DIR__ . '/config.php';

if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

if (!isset($_GET['id'])) {
    header("Location: requests.php");
    exit;
}

$request_id = (int)$_GET['id'];

// Fetch request with EFD details
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

if (!$request) die("Request not found");

// Fetch items
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
    $stmt = $pdo->prepare("
        SELECT ri.*, p.name as product_name, 0 as carton_weight
        FROM request_items ri
        JOIN products p ON ri.product_id = p.id
        WHERE ri.request_id = ?
    ");
    $stmt->execute([$request_id]);
    $items = $stmt->fetchAll();
}

// Calculate totals
$subtotal = 0;
$total_weight = 0;
$total_cartons_all = 0;
foreach ($items as &$item) {
    $item['calculated_total'] = $item['quantity'] * $item['unit_price'];
    $subtotal += $item['calculated_total'];
    $total_weight += ($item['carton_weight'] ?? 0) * $item['quantity'];
    $total_cartons_all += $item['quantity'];
}
unset($item);

$is_export = $request['is_export'] ?? 0;
$charges_efd = $request['charges_efd'] ?? 0;
$efd_profit_per_carton = floatval($request['efd_profit_per_carton'] ?? 2000);
$efd_rate = 0.18;

if ($is_export) {
    $vat_amount = 0;
    $grand_total = $subtotal;
} else {
    $line_totals = $subtotal;
    $subtotal = $line_totals / 1.18;
    $vat_amount = $subtotal * 0.18;
    $grand_total = $line_totals;
}

$efd_charge_per_carton = $efd_profit_per_carton * $efd_rate;
$efd_charge_total = $charges_efd ? ($efd_charge_per_carton * $total_cartons_all) : 0;
$grand_total_with_efd = $grand_total + $efd_charge_total;

$empty_rows = max(0, 3 - count($items));
$ref_no = str_pad($request['id'], 4, '0', STR_PAD_LEFT);
$pdf_filename = 'Request-' . $ref_no . '-' . strtoupper(str_replace(' ', '-', $request['customer_name'])) . '.pdf';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Request #<?php echo $ref_no; ?> - East African Spirit</title>
    <!-- html2pdf.js — converts HTML to PDF, downloads directly (no print dialog) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; background: #f3f4f6; color: #000; }

        /* ── Loading overlay ── */
        #pdf-overlay {
            position: fixed; inset: 0;
            background: rgba(255,255,255,0.95);
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            z-index: 9999; gap: 16px;
            font-family: Arial, sans-serif;
        }
        #pdf-overlay .spinner {
            width: 48px; height: 48px;
            border: 5px solid #e0e7ff;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        #pdf-overlay p { font-size: 15px; color: #374151; font-weight: 600; }
        #pdf-overlay small { font-size: 12px; color: #6b7280; }

        /* ── Top bar (hidden during PDF generation) ── */
        #top-bar {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 20px; background: #fff;
            border-bottom: 1px solid #e5e7eb;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        #top-bar a {
            display: inline-flex; align-items: center; gap: 6px;
            background: #f3f4f6; color: #374151; border: 1px solid #d1d5db;
            padding: 7px 14px; border-radius: 6px; text-decoration: none;
            font-size: 13px; font-weight: 500;
        }
        #top-bar button {
            display: inline-flex; align-items: center; gap: 6px;
            background: #6366f1; color: #fff; border: none;
            padding: 8px 18px; border-radius: 6px; font-size: 13px;
            font-weight: 600; cursor: pointer;
        }
        #top-bar button:hover { background: #4f46e5; }
        #top-bar .info { font-size: 12px; color: #6b7280; margin-left: auto; }

        /* ── Document page ── */
        #pdf-content {
            max-width: 750px;
            margin: 20px auto;
            background: #fff;
            padding: 20mm 18mm;
            border: 1px solid #d1d5db;
            border-radius: 4px;
        }

        /* Header */
        .doc-header { text-align: center; margin-bottom: 14px; }
        .doc-header h1 { font-size: 13pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.5px; }
        .doc-header p { font-size: 8.5pt; font-weight: 600; margin-top: 2px; }

        /* Meta info */
        .meta-row { display: flex; justify-content: space-between; font-size: 8.5pt; margin-bottom: 10px; }
        .meta-row div div { margin-bottom: 2px; }

        h2.doc-title {
            text-align: center; font-size: 9.5pt;
            text-decoration: underline; font-weight: 800;
            margin: 10px 0; text-transform: uppercase;
        }

        /* Tables */
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 3px 5px; font-size: 8pt; }
        th { background: #f5f5f5; font-weight: 700; }
        .tc { text-align: center; }
        .tr { text-align: right; }
        .tl { text-align: left; }

        /* Totals rows */
        .row-vat td { background: #dbeafe; font-weight: 700; }
        .row-efd td { background: #fff7ed; font-weight: 700; }
        .row-grand td { background: #f0f0f0; font-weight: 800; }

        /* Weight section */
        .weight-title {
            font-size: 8pt; font-weight: 700; text-align: center;
            background: #f0f0f0; padding: 3px; border: 1px solid #000;
            border-bottom: none;
        }

        /* ── Signatures — VERTICAL layout ── */
        .sigs-section { margin-top: 18px; }
        .sig-item {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
            font-size: 8.5pt;
        }
        .sig-item .sig-label {
            font-weight: 700;
            min-width: 110px;
            white-space: nowrap;
        }
        .sig-item .sig-line {
            flex: 1;
            border-bottom: 1px solid #000;
            height: 18px;
        }
    </style>
</head>
<body>

<!-- Loading overlay — shown while PDF generates -->
<div id="pdf-overlay">
    <div class="spinner"></div>
    <p>Generating PDF...</p>
    <small>Your download will start automatically</small>
</div>

<!-- Top bar shown after download finishes -->
<div id="top-bar" style="display:none;">
    <a href="view_request.php?id=<?php echo $request['id']; ?>">← Back to Request</a>
    <button onclick="downloadPDF()">⬇ Download Again</button>
    <span class="info">PDF saved as: <strong><?php echo htmlspecialchars($pdf_filename); ?></strong></span>
</div>

<!-- The document (this is what gets converted to PDF) -->
<div id="pdf-content">

    <!-- Header -->
    <div class="doc-header">
        <h1>East African Spirit (T) Ltd.</h1>
        <p>P.O.BOX 707 SHINYANGA</p>
    </div>

    <!-- Meta Info -->
    <div class="meta-row">
        <div>
            <div><strong>Customer:</strong> <?php echo strtoupper($request['customer_name']); ?></div>
            <div><strong>Truck No:</strong> <?php echo strtoupper($request['truck_no'] ?? ''); ?></div>
            <div><strong>Driver:</strong> <?php echo strtoupper($request['driver_name'] ?? ''); ?></div>
        </div>
        <div style="text-align: right;">
            <div><strong>Date:</strong> <?php echo date('d.m.Y', strtotime($request['request_date'])); ?></div>
            <div><strong>Route:</strong> <?php echo strtoupper($request['route'] ?? ''); ?></div>
            <div><strong>Ref:</strong> #<?php echo $ref_no; ?></div>
        </div>
    </div>

    <h2 class="doc-title">Request Note for Cartons</h2>

    <!-- Items Table -->
    <table style="margin-bottom: 0;">
        <thead>
            <tr>
                <th class="tc" style="width: 28px;">S/N</th>
                <th class="tl">Product Name</th>
                <th class="tc" style="width: 50px;">Qty</th>
                <th class="tr" style="width: 85px;">Price@</th>
                <th class="tr" style="width: 95px;">Total</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($items as $i => $item): ?>
            <tr>
                <td class="tc"><?php echo $i + 1; ?></td>
                <td style="font-weight: 600;"><?php echo strtoupper($item['product_name']); ?></td>
                <td class="tc"><?php echo $item['quantity']; ?></td>
                <td class="tr"><?php echo number_format($item['unit_price'], 2); ?></td>
                <td class="tr"><?php echo number_format($item['calculated_total'], 2); ?></td>
            </tr>
            <?php endforeach; ?>
            <?php for ($i = 0; $i < $empty_rows; $i++): ?>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
            <?php endfor; ?>

            <!-- Totals -->
            <?php if ($is_export): ?>
            <tr>
                <td colspan="3" rowspan="2" style="border: 1px solid #000;"></td>
                <td style="font-weight: 700;">SUBTOTAL</td>
                <td class="tr" style="font-weight: 700;"><?php echo number_format($subtotal, 2); ?></td>
            </tr>
            <tr class="row-grand">
                <td>GRAND TOTAL</td>
                <td class="tr"><?php echo number_format($grand_total_with_efd, 2); ?></td>
            </tr>
            <?php else: ?>
            <tr>
                <td colspan="3" rowspan="<?php echo $charges_efd ? 4 : 3; ?>" style="border: 1px solid #000;"></td>
                <td style="font-weight: 700;">SUBTOTAL</td>
                <td class="tr" style="font-weight: 700;"><?php echo number_format($subtotal, 2); ?></td>
            </tr>
            <tr class="row-vat">
                <td>VAT (18%)</td>
                <td class="tr"><?php echo number_format($vat_amount, 2); ?></td>
            </tr>
            <?php if ($charges_efd): ?>
            <tr class="row-efd">
                <td>EFD CHARGE (<?php echo number_format($efd_charge_per_carton, 0); ?>/ctn &times; <?php echo $total_cartons_all; ?> ctns)</td>
                <td class="tr"><?php echo number_format($efd_charge_total, 2); ?></td>
            </tr>
            <?php endif; ?>
            <tr class="row-grand">
                <td>GRAND TOTAL<?php echo $charges_efd ? ' (Incl. EFD)' : ' (Incl. VAT)'; ?></td>
                <td class="tr"><?php echo number_format($grand_total_with_efd, 2); ?></td>
            </tr>
            <?php endif; ?>
        </tbody>
    </table>

    <!-- Weight Section -->
    <div style="margin-top: 14px;">
        <div class="weight-title">CARTONS' TOTAL WEIGHT (KGS)</div>
        <table>
            <thead>
                <tr>
                    <th class="tl">Product</th>
                    <th class="tc" style="width: 55px;">Qty</th>
                    <th class="tc" style="width: 70px;">Wt/Ctn (kg)</th>
                    <th class="tr" style="width: 80px;">Total (kg)</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($items as $item): ?>
                <tr>
                    <td><?php echo strtoupper($item['product_name']); ?></td>
                    <td class="tc"><?php echo $item['quantity']; ?></td>
                    <td class="tc"><?php echo number_format($item['carton_weight'] ?? 0, 2); ?></td>
                    <td class="tr"><?php echo number_format(($item['carton_weight'] ?? 0) * $item['quantity'], 2); ?></td>
                </tr>
                <?php endforeach; ?>
                <tr style="background: #f0f0f0; font-weight: 700;">
                    <td colspan="3" class="tr">TOTAL WEIGHT:</td>
                    <td class="tr"><?php echo number_format($total_weight, 2); ?> kg</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Signatures — Vertical Layout -->
    <div class="sigs-section">
        <div class="sig-item">
            <span class="sig-label">Prepared by:</span>
            <span class="sig-line"></span>
        </div>
        <div class="sig-item">
            <span class="sig-label">Requested by:</span>
            <span class="sig-line"></span>
        </div>
        <div class="sig-item">
            <span class="sig-label">Authorised by:</span>
            <span class="sig-line"></span>
        </div>
        <div class="sig-item">
            <span class="sig-label">Approved by:</span>
            <span class="sig-line"></span>
        </div>
    </div>

</div><!-- /#pdf-content -->

<script>
    var PDF_FILENAME = '<?php echo addslashes($pdf_filename); ?>';

    function downloadPDF() {
        var overlay = document.getElementById('pdf-overlay');
        var topBar  = document.getElementById('top-bar');
        var element = document.getElementById('pdf-content');

        overlay.style.display = 'flex';
        topBar.style.display  = 'none';

        var opt = {
            margin:      [8, 10, 8, 10],   // top, right, bottom, left (mm)
            filename:    PDF_FILENAME,
            image:       { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:   { mode: ['avoid-all', 'css'] }
        };

        html2pdf()
            .set(opt)
            .from(element)
            .save()
            .then(function() {
                overlay.style.display = 'none';
                topBar.style.display  = 'flex';
            });
    }

    // Auto-download on page load
    window.addEventListener('load', function() {
        // Small delay so the library fully initialises
        setTimeout(downloadPDF, 600);
    });
</script>
</body>
</html>
