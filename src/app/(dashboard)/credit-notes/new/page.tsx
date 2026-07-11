"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Customer { id: number; name: string; location: string; }
interface Product { id: number; name: string; default_price: number; }
interface Order { id: number; route: string; created_at: string; status: string; }

interface LineItem {
  product_id: string;   // "" = custom adjustment line
  description: string;
  quantity: string;
  unit_price: string;
}

const emptyLine = (): LineItem => ({ product_id: "", description: "", quantity: "1", unit_price: "" });

export default function NewCreditNotePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const canCreate = ["admin", "accountant"].includes(session?.user?.role ?? "");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts]   = useState<Product[]>([]);
  const [orders, setOrders]       = useState<Order[]>([]);
  const [prices, setPrices]       = useState<Record<number, number>>({});

  const [customerId, setCustomerId] = useState("");
  const [requestId, setRequestId]   = useState("");
  const [creditDate, setCreditDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason]         = useState("");
  const [items, setItems]           = useState<LineItem[]>([emptyLine()]);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers?all=true").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([c, p]) => {
      setCustomers(Array.isArray(c) ? c : c.data || []);
      setProducts(Array.isArray(p) ? p : p.data || []);
    });
  }, []);

  useEffect(() => {
    if (!customerId) { setOrders([]); setPrices({}); return; }
    fetch(`/api/customers/${customerId}/orders`)
      .then((r) => r.json())
      .then((o) => setOrders(Array.isArray(o) ? o.slice(0, 20) : []))
      .catch(() => setOrders([]));
    fetch(`/api/customers/${customerId}/prices`)
      .then((r) => r.json())
      .then((p) => {
        const map: Record<number, number> = {};
        (Array.isArray(p) ? p : []).forEach((pr: { product_id: number; price: number }) => {
          map[pr.product_id] = Number(pr.price);
        });
        setPrices(map);
      })
      .catch(() => setPrices({}));
  }, [customerId]);

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const handleProductChange = (index: number, value: string) => {
    if (value === "custom") {
      updateItem(index, { product_id: "", unit_price: "" });
      return;
    }
    const pid = parseInt(value);
    const product = products.find((p) => p.id === pid);
    const price = prices[pid] ?? product?.default_price ?? 0;
    updateItem(index, {
      product_id: value,
      description: "",
      unit_price: price ? String(price) : "",
    });
  };

  const total = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );

  const handleSubmit = async () => {
    if (!customerId) return toast.error("Select a customer");
    if (!reason.trim()) return toast.error("Enter a reason for the credit note");
    for (const it of items) {
      if (!it.product_id && !it.description.trim()) {
        return toast.error("Each line needs a product or a description");
      }
      if (!(Number(it.quantity) > 0) || !(Number(it.unit_price) > 0)) {
        return toast.error("Quantities and amounts must be greater than zero");
      }
    }

    setSaving(true);
    const res = await fetch("/api/credit-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: parseInt(customerId),
        request_id: requestId && requestId !== "none" ? parseInt(requestId) : null,
        reason: reason.trim(),
        credit_date: creditDate,
        items: items.map((it) => ({
          product_id: it.product_id ? parseInt(it.product_id) : null,
          description: it.description.trim() || null,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(d.error || "Failed to create credit note");
    } else {
      toast.success(`Credit note ${d.credit_note_no} created`);
      router.push(`/credit-notes/${d.id}`);
    }
  };

  if (sessionStatus !== "loading" && !canCreate) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-3">
        <p className="text-lg font-semibold">Not allowed</p>
        <p className="text-sm text-muted-foreground">Only admins and accountants can create credit notes.</p>
        <Button variant="outline" asChild>
          <Link href="/credit-notes"><ArrowLeft className="h-4 w-4" /> Back to credit notes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/credit-notes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Credit Note</h1>
          <p className="text-sm text-muted-foreground">Credit a customer for returns, damages or overcharges</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setRequestId(""); }}>
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
          <div className="space-y-2">
            <Label>Related order (optional)</Label>
            <Select value={requestId} onValueChange={setRequestId} disabled={!customerId}>
              <SelectTrigger><SelectValue placeholder="Link to an order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    #{o.id} — {o.route} ({o.created_at.slice(0, 10)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Credit date *</Label>
            <Input type="date" value={creditDate} onChange={(e) => setCreditDate(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Reason *</Label>
            <Input
              placeholder="e.g. 12 cartons returned damaged, overcharge on invoice #302..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Credit Lines</CardTitle>
            <CardDescription>Returned products at their sale price, or a custom adjustment amount</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setItems((p) => [...p, emptyLine()])}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-lg border p-3">
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-xs">Product / type</Label>
                <Select
                  value={item.product_id || "custom"}
                  onValueChange={(v) => handleProductChange(i, v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom adjustment</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!item.product_id && (
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    placeholder="What is being credited?"
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                </div>
              )}
              <div className={`${item.product_id ? "sm:col-span-3" : "sm:col-span-2"} space-y-1`}>
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number" min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, { quantity: e.target.value })}
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label className="text-xs">Unit amount (TZS)</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold whitespace-nowrap">
                  {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                </p>
                {items.length > 1 && (
                  <Button
                    variant="ghost" size="icon"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t pt-4">
            <p className="font-semibold">Total credit</p>
            <p className="text-lg font-bold text-rose-600">{formatCurrency(total)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/credit-notes">Cancel</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving..." : "Create Credit Note"}
        </Button>
      </div>
    </div>
  );
}
