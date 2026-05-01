"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Printer, CheckCircle, Pencil, Truck,
  User, MapPin, Calendar, Package, Receipt, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface RequestDetail {
  id: number; status: string; truck_number: string; driver_name: string; route: string;
  vat_percentage: number; created_at: string; request_date?: string;
  customer_name: string; customer_location: string;
  is_export: boolean; charges_efd: boolean; efd_profit_per_carton: number;
  user_name: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number; carton_weight: number }>;
  signatures: Array<{ signature_type: string; user_name: string; signed_at: string }>;
}

const statusColors: Record<string, string> = {
  pending:    "text-amber-700 bg-amber-50 border-amber-200",
  approved:   "text-emerald-700 bg-emerald-50 border-emerald-200",
  dispatched: "text-blue-700 bg-blue-50 border-blue-200",
  rejected:   "text-red-700 bg-red-50 border-red-200",
};

const sigTypeLabel: Record<string, string> = {
  prepared_by:   "Prepared By",
  requested_by:  "Requested By",
  authorised_by: "Authorised By",
  approved_by:   "Approved By",
};

const ALL_SIG_TYPES = ["prepared_by", "requested_by", "authorised_by", "approved_by"];

export default function ViewRequestPage() {
  const params  = useParams();
  const router  = useRouter();
  const { data: session } = useSession();
  const [request, setRequest]     = useState<RequestDetail | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/requests/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data;
      })
      .then(setRequest)
      .catch((err) => setError(err.message || "Failed to load request"));
  }, [params.id]);

  const handleApprove = async () => {
    setApproving(true);
    const res = await fetch(`/api/requests/${params.id}/sign`, { method: "POST" });
    if (res.ok) {
      toast.success("Request approved successfully");
      const updated = await fetch(`/api/requests/${params.id}`).then((r) => r.json());
      setRequest(updated);
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to approve");
    }
    setApproving(false);
  };

  const handleDownloadPdf = async () => {
    if (!docRef.current || !request) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(docRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (imgH <= pageH - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
      } else {
        // Multi-page: slice canvas into A4-height chunks
        const sliceH = Math.floor((canvas.width * (pageH - margin * 2)) / imgW);
        let yOffset = 0;
        let page = 0;
        while (yOffset < canvas.height) {
          if (page > 0) pdf.addPage();
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.min(sliceH, canvas.height - yOffset);
          const ctx = sliceCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -yOffset);
          const sliceData = sliceCanvas.toDataURL("image/png");
          const sliceImgH = (sliceCanvas.height * imgW) / canvas.width;
          pdf.addImage(sliceData, "PNG", margin, margin, imgW, sliceImgH);
          yOffset += sliceH;
          page++;
        }
      }

      pdf.save(`Request-${request.id}-${request.customer_name.replace(/\s+/g, "_")}.pdf`);
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
    setDownloading(false);
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Error loading request</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Financial calculations
  // Prices stored are ex-VAT. VAT is added on top for local customers.
  const subtotal   = request.items.reduce((s, i) => s + Number(i.total_price), 0);
  const vatAmount  = request.is_export ? 0 : subtotal * (request.vat_percentage / 100);
  const grandTotal = subtotal + vatAmount;
  const efdCharge   = request.charges_efd
    ? request.items.reduce((s, i) => s + i.quantity * request.efd_profit_per_carton, 0)
    : 0;
  const totalWeight = request.items.reduce((s, i) => s + i.quantity * (i.carton_weight || 0), 0);

  const canApprove = (session?.user?.role === "accountant" || session?.user?.role === "admin")
    && request.status === "pending";

  const sigMap = Object.fromEntries(request.signatures.map((s) => [s.signature_type, s]));
  const displayDate = request.request_date
    ? formatDate(request.request_date)
    : formatDate(request.created_at);

  const refNo = `${new Date(request.request_date || request.created_at).getFullYear()}${String(request.id).padStart(4, "0")}`;

  return (
    <>
      {/* ── SCREEN VIEW ── */}
      <div className="max-w-4xl mx-auto space-y-6 no-print">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Request #{request.id}</h1>
              <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[request.status] || ""}`}>
                {request.status}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" />Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloading}>
              <Download className="h-4 w-4 mr-1" />
              {downloading ? "Generating…" : "Download PDF"}
            </Button>
            {session?.user?.role === "admin" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/requests/${request.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-1" />Edit
                </Link>
              </Button>
            )}
            {canApprove && (
              <Button size="sm" onClick={handleApprove} disabled={approving}>
                <CheckCircle className="h-4 w-4 mr-1" />
                {approving ? "Approving..." : "Approve"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-bold text-lg">{request.customer_name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />{request.customer_location}
              </p>
              <div className="flex gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-md ${request.is_export ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {request.is_export ? "Export (No VAT)" : "Local (18% VAT)"}
                </span>
                {request.charges_efd && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">EFD Charges</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Truck className="h-4 w-4" />Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Truck</p>
                <p className="font-medium font-mono">{request.truck_number}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Driver</p>
                <p className="font-medium">{request.driver_name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Route</p>
                <p className="font-medium">{request.route}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Date</p>
                <p className="font-medium">{displayDate}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />Products
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Unit Price</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium">{item.product_name}</td>
                      <td className="px-4 py-2.5 text-right">{item.quantity.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(item.total_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t">
              <div className="ml-auto max-w-xs space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {!request.is_export && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT ({request.vat_percentage}%)</span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                )}
                {request.charges_efd && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">EFD Charge</span>
                    <span>{formatCurrency(efdCharge)}</span>
                  </div>
                )}
                {totalWeight > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Weight</span>
                    <span>{totalWeight.toFixed(1)} kg</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total</span>
                  <span className="text-indigo-600">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signatures */}
        {request.signatures.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />Approval Chain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {request.signatures.map((sig) => (
                  <div key={sig.signature_type} className="text-center border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{sigTypeLabel[sig.signature_type] || sig.signature_type}</p>
                    <p className="font-medium text-sm mt-2">{sig.user_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(sig.signed_at)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── PRINT / PDF DOCUMENT ── hidden on screen, shown when printing ── */}
      <div className="hidden print-only">
        <div
          ref={docRef}
          style={{
            fontFamily: "Arial, sans-serif",
            color: "#000",
            fontSize: "10pt",
            background: "#fff",
            padding: "20px 24px",
            maxWidth: "700px",
            margin: "0 auto",
            border: "1px solid #000",
          }}
        >
          {/* ── Company Header ── */}
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "14pt", fontWeight: "bold", letterSpacing: "0.5px" }}>
              EAST AFRICAN SPIRIT (T) LTD.
            </div>
            <div style={{ fontSize: "9pt", marginTop: "2px" }}>P.O.BOX 707 SHINYANGA</div>
          </div>

          <div style={{ borderBottom: "1px solid #000", marginBottom: "10px" }} />

          {/* ── Info Grid ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "10px" }}>
            <tbody>
              <tr>
                <td style={{ width: "50%", padding: "2px 4px" }}>
                  <span style={{ fontWeight: "bold" }}>Customer: </span>{request.customer_name}
                </td>
                <td style={{ width: "50%", padding: "2px 4px" }}>
                  <span style={{ fontWeight: "bold" }}>Date: </span>{displayDate}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "2px 4px" }}>
                  <span style={{ fontWeight: "bold" }}>Truck No: </span>{request.truck_number || "—"}
                </td>
                <td style={{ padding: "2px 4px" }}>
                  <span style={{ fontWeight: "bold" }}>Route: </span>{request.route || "—"}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "2px 4px" }}>
                  <span style={{ fontWeight: "bold" }}>Driver: </span>{request.driver_name || "—"}
                </td>
                <td style={{ padding: "2px 4px" }}>
                  <span style={{ fontWeight: "bold" }}>Ref: </span>{refNo}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Document Title ── */}
          <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", textDecoration: "underline", marginBottom: "10px", textTransform: "uppercase" }}>
            Request Note for Cartons
          </div>

          {/* ── Products Table ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "8px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center", width: "32px" }}>S/N</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "left" }}>PRODUCT NAME</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center", width: "50px" }}>QTY</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", width: "110px" }}>PRICE@</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", width: "120px" }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{item.product_name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>{item.quantity.toLocaleString()}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right" }}>{Number(item.unit_price).toLocaleString()}</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right" }}>{Number(item.total_price).toLocaleString()}</td>
                </tr>
              ))}
              {/* Empty rows to pad the table */}
              {request.items.length < 6 && Array.from({ length: 6 - request.items.length }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>&nbsp;</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Totals ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt", marginBottom: "12px" }}>
            <tbody>
              <tr>
                <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right", width: "70%" }}>
                  SUBTOTAL (Excl. VAT)
                </td>
                <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right", width: "30%", fontWeight: "bold" }}>
                  {Math.round(subtotal).toLocaleString()}
                </td>
              </tr>
              {!request.is_export && (
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right" }}>
                    VAT ({request.vat_percentage}%)
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right", fontWeight: "bold" }}>
                    {Math.round(vatAmount).toLocaleString()}
                  </td>
                </tr>
              )}
              {request.charges_efd && (
                <tr>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right" }}>EFD Charge</td>
                  <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "right", fontWeight: "bold" }}>
                    {Math.round(efdCharge).toLocaleString()}
                  </td>
                </tr>
              )}
              <tr style={{ backgroundColor: "#f5f5f5" }}>
                <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right", fontWeight: "bold", fontSize: "10pt" }}>
                  GRAND TOTAL (Incl. VAT)
                </td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right", fontWeight: "bold", fontSize: "10pt" }}>
                  {Math.round(grandTotal + efdCharge).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* ── Weight Table ── */}
          {totalWeight > 0 && (
            <>
              <div style={{ fontSize: "9pt", fontWeight: "bold", marginBottom: "4px", textTransform: "uppercase" }}>
                Weight Summary
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt", marginBottom: "14px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "left" }}>Product</th>
                    <th style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "center", width: "50px" }}>Qty</th>
                    <th style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "center", width: "80px" }}>Wt/Ctn (kg)</th>
                    <th style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "right", width: "90px" }}>Total (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {request.items.filter((i) => i.carton_weight > 0).map((item, i) => (
                    <tr key={i}>
                      <td style={{ border: "1px solid #ccc", padding: "3px 6px" }}>{item.product_name}</td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "center" }}>{item.carton_weight}</td>
                      <td style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "right" }}>
                        {(item.quantity * item.carton_weight).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <td colSpan={3} style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "right", fontWeight: "bold" }}>
                      TOTAL WEIGHT
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "3px 6px", textAlign: "right", fontWeight: "bold" }}>
                      {totalWeight.toFixed(1)} kg
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* ── Signatures ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "10px" }}>
            {ALL_SIG_TYPES.map((type) => {
              const sig = sigMap[type];
              const showName = type !== "approved_by";
              return (
                <div key={type} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "8pt", textTransform: "uppercase", marginBottom: "28px" }}>
                    {sigTypeLabel[type]}
                  </div>
                  <div style={{ borderBottom: "1px solid #000", marginBottom: "3px" }} />
                  <div style={{ fontSize: "8pt" }}>
                    {showName && sig ? sig.user_name : " "}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
