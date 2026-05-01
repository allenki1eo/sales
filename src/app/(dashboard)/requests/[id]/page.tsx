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
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

interface RequestDetail {
  id: number; status: string; truck_number: string; driver_name: string; route: string;
  vat_percentage: number; created_at: string; customer_name: string; customer_location: string;
  is_export: boolean; charges_efd: boolean; efd_profit_per_carton: number;
  user_name: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number; total_price: number; carton_weight: number }>;
  signatures: Array<{ signature_type: string; user_name: string; signed_at: string }>;
}

const statusColors: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
  dispatched: "text-blue-700 bg-blue-50 border-blue-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
};

const sigTypeLabel: Record<string, string> = {
  prepared_by: "Prepared By",
  requested_by: "Requested By",
  authorised_by: "Authorised By",
  approved_by: "Approved By",
};

export default function ViewRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetch(`/api/requests/${params.id}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setRequest)
      .catch(() => { toast.error("Request not found"); router.push("/requests"); });
  }, [params.id, router]);

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

  if (!request) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const subtotal = request.items.reduce((s, i) => s + Number(i.total_price), 0);
  const vatAmount = request.is_export ? 0 : subtotal * (request.vat_percentage / 100);
  const efdCharge = request.charges_efd
    ? request.items.reduce((s, i) => s + i.quantity * request.efd_profit_per_carton * 0.18, 0)
    : 0;
  const grandTotal = subtotal + vatAmount + efdCharge;
  const totalWeight = request.items.reduce((s, i) => s + i.quantity * (i.carton_weight || 0), 0);

  const canApprove = (session?.user?.role === "accountant" || session?.user?.role === "admin")
    && request.status === "pending";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
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

      {/* Print header */}
      <div className="hidden print-only text-center py-4 border-b">
        <h1 className="text-2xl font-bold">EAST AFRICAN SPIRIT (T) LTD</h1>
        <h2 className="text-lg mt-1">DELIVERY REQUEST</h2>
        <p className="text-sm text-muted-foreground">Request #{request.id}</p>
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
              <p className="font-medium">{formatDate(request.created_at)}</p>
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
                    <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(item.total_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
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
  );
}
