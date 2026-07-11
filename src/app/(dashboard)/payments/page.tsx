"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Wallet, Plus, Search, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentRow {
  id: number;
  customer_id: number;
  customer_name: string;
  user_name: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
  notes: string | null;
}

interface Customer { id: number; name: string; location: string; }

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank",
  mobile_money: "Mobile Money",
  cheque: "Cheque",
  other: "Other",
};

export default function PaymentsPage() {
  const { data: session } = useSession();
  const canRecord = ["admin", "accountant"].includes(session?.user?.role ?? "");
  const isAdmin = session?.user?.role === "admin";

  const [rows, setRows]             = useState<PaymentRow[]>([]);
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Record-payment dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/customers?all=true")
      .then((r) => r.json())
      .then((c) => setCustomers(Array.isArray(c) ? c : c.data || []))
      .catch(() => setCustomers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (customerFilter !== "all") params.set("customer_id", customerFilter);
    const res = await fetch(`/api/payments?${params}`);
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.error || "Failed to load payments");
    } else {
      setRows(d.data);
      setTotalPages(d.totalPages || 1);
    }
    setLoading(false);
  }, [page, search, customerFilter]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleRecord = async () => {
    if (!form.customer_id) return toast.error("Select a customer");
    if (!(Number(form.amount) > 0)) return toast.error("Enter a valid amount");

    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: parseInt(form.customer_id),
        amount: Number(form.amount),
        payment_date: form.payment_date,
        method: form.method,
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(d.error || "Failed to record payment");
    } else {
      toast.success("Payment recorded");
      setDialogOpen(false);
      setForm((f) => ({ ...f, amount: "", reference: "", notes: "" }));
      load();
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) toast.error(d.error || "Failed to delete payment");
    else {
      toast.success("Payment deleted");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-500" />
            Customer Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Money received from customers — feeds their statements of account
          </p>
        </div>
        {canRecord && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Record Payment</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record a payment</DialogTitle>
                <DialogDescription>Money received from a customer</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select value={form.customer_id} onValueChange={(v) => setForm((f) => ({ ...f, customer_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}{c.location ? ` — ${c.location}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Amount (TZS) *</Label>
                    <Input
                      type="number" min="0" step="0.01" placeholder="0"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(METHOD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference</Label>
                    <Input
                      placeholder="Receipt / txn no."
                      value={form.reference}
                      onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleRecord} disabled={saving}>
                  {saving ? "Saving..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or reference..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={customerFilter} onValueChange={(v) => { setCustomerFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No payments recorded yet
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABELS[p.method] || p.method}
                      {p.reference ? ` · ${p.reference}` : ""} · by {p.user_name}
                    </p>
                    {p.notes && <p className="text-xs text-muted-foreground truncate">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(Number(p.amount))}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</p>
                    </div>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {formatCurrency(Number(p.amount))} from {p.customer_name} on {formatDate(p.payment_date)} will be removed
                              and the customer&apos;s statement will change. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-red-600 hover:bg-red-700">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
