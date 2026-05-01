"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft, Printer, CheckCircle, Pencil, Truck,
  User, MapPin, Calendar, Package, Receipt,
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
  const [request, setRequest]   = useState<RequestDetail | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

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

  const subtotal    = request.items.reduce((s, i) => s + Number(i.total_price), 0);
  const vatAmount   = request.is_export ? 0 : subtotal * (request.vat_percentage / 100);
  const efdCharge   = request.charges_efd
    ? request.items.reduce((s, i) => s + i.quantity * request.efd_profit_per_carton * 0.18, 0)
    : 0;
  const grandTotal  = subtotal + vatAmount + efdCharge;
  const totalWeight = request.items.reduce((s, i) => s + i.quantity * (i.carton_weight || 0), 0);

  const canApprove = (session?.user?.role === "accountant" || session?.user?.role === "admin")
    && request.status === "pending";

  const sigMap = Object.fromEntries(request.signatures.map((s) => [s.signature_type, s]));
  const displayDate = request.request_date
    ? formatDate(request.request_date)
    : formatDate(request.created_at);

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
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty (cartons)</th>
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

      {/* ── PRINT DOCUMENT ── hidden on screen, shown when printing ── */}
      <div className="hidden print-only" style={{ fontFamily: "Arial, sans-serif", color: "#000", fontSize: "11pt" }}>

        {/* Company Header */}
        <div className="print-no-break" style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "12px" }}>
          <div style={{ fontSize: "17pt", fontWeight: "bold", letterSpacing: "1px" }}>
            EAST AFRICAN SPIRIT (T) LTD
          </div>
          <div style={{ fontSize: "9pt", color: "#333", marginTop: "2px" }}>
            Sales &amp; Distribution Division
          </div>
        </div>

        {/* Document Title + Number */}
        <div className="print-no-break" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
          <div>
            <div style={{ fontSize: "13pt", fontWeight: "bold", textTransform: "uppercase" }}>
              Delivery / Sales Request
            </div>
            <div style={{ fontSize: "9pt", color: "#555", marginTop: "2px" }}>
              Status:{" "}
              <span style={{ fontWeight: "bold", textTransform: "capitalize" }}>
                {request.status}
              </span>
              {request.is_export && " · Export (Tax-Exempt)"}
              {request.charges_efd && " · EFD Charges Apply"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13pt", fontWeight: "bold" }}>No. {request.id}</div>
            <div style={{ fontSize: "9pt", color: "#555", marginTop: "2px" }}>Date: {displayDate}</div>
            <div style={{ fontSize: "9pt", color: "#555" }}>Prepared: {formatDate(request.created_at)}</div>
          </div>
        </div>

        {/* Customer + Delivery Info — two columns */}
        <div className="print-no-break" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px",
        }}>
          <div style={{ border: "1px solid #000", padding: "8px 10px" }}>
            <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase", borderBottom: "1px solid #aaa", paddingBottom: "4px", marginBottom: "6px" }}>
              Customer
            </div>
            <table style={{ fontSize: "10pt", width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#555", paddingRight: "6px", paddingBottom: "3px", whiteSpace: "nowrap" }}>Name:</td>
                  <td style={{ fontWeight: "bold" }}>{request.customer_name}</td>
                </tr>
                <tr>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Location:</td>
                  <td>{request.customer_location || "—"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#555" }}>Type:</td>
                  <td>{request.is_export ? "Export (No VAT)" : "Local (18% VAT)"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ border: "1px solid #000", padding: "8px 10px" }}>
            <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase", borderBottom: "1px solid #aaa", paddingBottom: "4px", marginBottom: "6px" }}>
              Delivery Details
            </div>
            <table style={{ fontSize: "10pt", width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#555", paddingRight: "6px", paddingBottom: "3px", whiteSpace: "nowrap" }}>Truck No:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>{request.truck_number || "—"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#555", paddingBottom: "3px" }}>Driver:</td>
                  <td>{request.driver_name || "—"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#555" }}>Route:</td>
                  <td>{request.route || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Products Table */}
        <div className="print-no-break" style={{ marginBottom: "12px" }}>
          <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase", marginBottom: "4px" }}>
            Products / Items
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "left", width: "30px" }}>#</th>
                <th style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "left" }}>Product Description</th>
                <th style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "right", whiteSpace: "nowrap" }}>Qty (Cartons)</th>
                <th style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "right" }}>Unit Price (TZS)</th>
                <th style={{ border: "1px solid #000", padding: "5px 8px", textAlign: "right" }}>Total (TZS)</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px" }}>{item.product_name}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right" }}>{item.quantity.toLocaleString()}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right" }}>{Number(item.unit_price).toLocaleString()}</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 8px", textAlign: "right", fontWeight: "bold" }}>{Number(item.total_price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="print-no-break" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <table style={{ fontSize: "10pt", borderCollapse: "collapse", minWidth: "260px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 12px 3px 0", color: "#555" }}>Subtotal (excl. VAT)</td>
                <td style={{ padding: "3px 0", textAlign: "right" }}>{formatCurrency(subtotal)}</td>
              </tr>
              {!request.is_export && (
                <tr>
                  <td style={{ padding: "3px 12px 3px 0", color: "#555" }}>VAT ({request.vat_percentage}%)</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>{formatCurrency(vatAmount)}</td>
                </tr>
              )}
              {request.charges_efd && (
                <tr>
                  <td style={{ padding: "3px 12px 3px 0", color: "#555" }}>EFD Charge</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>{formatCurrency(efdCharge)}</td>
                </tr>
              )}
              {totalWeight > 0 && (
                <tr>
                  <td style={{ padding: "3px 12px 3px 0", color: "#555" }}>Total Weight</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>{totalWeight.toFixed(1)} kg</td>
                </tr>
              )}
              <tr>
                <td colSpan={2} style={{ borderTop: "2px solid #000", padding: "0" }} />
              </tr>
              <tr>
                <td style={{ padding: "5px 12px 3px 0", fontWeight: "bold", fontSize: "11pt" }}>GRAND TOTAL</td>
                <td style={{ padding: "5px 0 3px", fontWeight: "bold", fontSize: "11pt", textAlign: "right" }}>
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signature Boxes */}
        <div className="print-no-break" style={{ borderTop: "1px solid #000", paddingTop: "14px" }}>
          <div style={{ fontWeight: "bold", fontSize: "9pt", textTransform: "uppercase", marginBottom: "10px" }}>
            Authorisation &amp; Signatures
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {ALL_SIG_TYPES.map((type) => {
              const sig = sigMap[type];
              return (
                <div key={type} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "8pt", color: "#555", textTransform: "uppercase", marginBottom: "6px" }}>
                    {sigTypeLabel[type]}
                  </div>
                  {/* Signature area */}
                  <div style={{ borderBottom: "1px solid #000", minHeight: "44px", marginBottom: "4px", position: "relative" }}>
                    {sig && (
                      <div style={{ fontSize: "9pt", fontWeight: "bold", position: "absolute", bottom: "4px", left: 0, right: 0, textAlign: "center" }}>
                        {sig.user_name}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: "8pt", color: "#555" }}>
                    {sig ? `${sig.user_name} · ${formatDate(sig.signed_at)}` : "Name / Date"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "18px", borderTop: "1px solid #ccc", paddingTop: "6px", fontSize: "8pt", color: "#777", textAlign: "center" }}>
          This document was generated by the EAS Sales Management System · Request #{request.id} · {formatDate(request.created_at)}
        </div>
      </div>
    </>
  );
}
