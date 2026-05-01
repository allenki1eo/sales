"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, MapPin, Phone, Package, Save, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Customer {
  id: number; name: string; location: string; phone: string;
  is_export: boolean; charges_efd: boolean; efd_profit_per_carton: number;
}
interface CustomerPrice { product_id: number; product_name: string; price: number; default_price: number; }
interface Order {
  id: number; status: string; route: string; truck_number: string;
  driver_name: string; request_date: string | null; created_at: string;
  month: string; total_value: number; total_cartons: number;
}

interface MonthGroup {
  month: string;
  label: string;
  orders: Order[];
  total_value: number;
  total_cartons: number;
  total_orders: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700",
  approved:   "bg-emerald-100 text-emerald-700",
  dispatched: "bg-blue-100 text-blue-700",
  rejected:   "bg-red-100 text-red-700",
};

function groupByMonth(orders: Order[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const o of orders) {
    const key = o.month || o.created_at.slice(0, 7);
    if (!map.has(key)) {
      const [year, mon] = key.split("-");
      const label = new Date(parseInt(year), parseInt(mon) - 1, 1)
        .toLocaleDateString("en-US", { month: "long", year: "numeric" });
      map.set(key, { month: key, label, orders: [], total_value: 0, total_cartons: 0, total_orders: 0 });
    }
    const g = map.get(key)!;
    g.orders.push(o);
    g.total_value   += Number(o.total_value);
    g.total_cartons += Number(o.total_cartons);
    g.total_orders  += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
}

export default function ViewCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer]           = useState<Customer | null>(null);
  const [prices, setPrices]               = useState<CustomerPrice[]>([]);
  const [orders, setOrders]               = useState<Order[]>([]);
  const [editedPrices, setEditedPrices]   = useState<Record<number, number>>({});
  const [savingPrice, setSavingPrice]     = useState<number | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${params.id}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data;
      }),
      fetch(`/api/customers/${params.id}/prices`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data;
      }),
      fetch(`/api/customers/${params.id}/orders`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        return data;
      }),
    ]).then(([c, p, o]) => {
      setCustomer(c);
      setPrices(p);
      const edited: Record<number, number> = {};
      p.forEach((pr: CustomerPrice) => { edited[pr.product_id] = pr.price; });
      setEditedPrices(edited);
      setOrders(o);
      // Auto-expand the most recent month
      if (o.length > 0) {
        const firstMonth = (o[0].month || o[0].created_at.slice(0, 7));
        setExpandedMonths(new Set([firstMonth]));
      }
    }).catch((err) => setError(err.message || "Failed to load customer"));
  }, [params.id]);

  const handleSavePrice = async (productId: number) => {
    setSavingPrice(productId);
    const res = await fetch(`/api/customers/${params.id}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, price: editedPrices[productId] }),
    });
    if (res.ok) toast.success("Price updated");
    else toast.error("Failed to update price");
    setSavingPrice(null);
  };

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Error loading customer</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const monthGroups = groupByMonth(orders);
  const lifetimeValue   = orders.reduce((s, o) => s + Number(o.total_value), 0);
  const lifetimeCartons = orders.reduce((s, o) => s + Number(o.total_cartons), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {customer.location && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{customer.location}
                </span>
              )}
              {customer.phone && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />{customer.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/customers/${params.id}/edit`}>
            <Pencil className="h-4 w-4 mr-1" />Edit
          </Link>
        </Button>
      </div>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span className={`text-sm px-3 py-1 rounded-lg font-medium ${customer.is_export ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
          {customer.is_export ? "Export Customer (No VAT)" : "Local Customer (18% VAT)"}
        </span>
        {customer.charges_efd && (
          <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-medium">
            EFD Machine · TZS {customer.efd_profit_per_carton}/carton
          </span>
        )}
      </div>

      <Tabs defaultValue="pricing">
        <TabsList>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="orders">
            Order History
            {orders.length > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{orders.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-600" />
                Custom Pricing
              </CardTitle>
              <CardDescription>
                Set custom prices per product for this customer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {prices.map((p) => (
                  <div key={p.product_id} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Default: {formatCurrency(p.default_price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">TZS</span>
                        <Input
                          type="number"
                          className="w-32 pl-10 text-sm h-8"
                          value={editedPrices[p.product_id] ?? p.price}
                          onChange={(e) => setEditedPrices((prev) => ({ ...prev, [p.product_id]: parseFloat(e.target.value) || 0 }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => handleSavePrice(p.product_id)}
                        disabled={savingPrice === p.product_id}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {prices.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No custom pricing configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order History Tab */}
        <TabsContent value="orders" className="mt-4 space-y-4">
          {/* Summary stats */}
          {orders.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold mt-0.5">{orders.length}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Lifetime Value</p>
                <p className="text-lg font-bold mt-0.5 text-indigo-600">{formatCurrency(lifetimeValue)}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Cartons</p>
                <p className="text-xl font-bold mt-0.5">{lifetimeCartons.toLocaleString()}</p>
              </div>
            </div>
          )}

          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No orders found for this customer</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {monthGroups.map((group) => {
                const expanded = expandedMonths.has(group.month);
                return (
                  <Card key={group.month} className="overflow-hidden">
                    {/* Month header — clickable */}
                    <button
                      className="w-full text-left"
                      onClick={() => toggleMonth(group.month)}
                    >
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3">
                          {expanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          }
                          <div>
                            <p className="font-semibold text-sm">{group.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.total_orders} order{group.total_orders !== 1 ? "s" : ""}
                              {" · "}
                              {group.total_cartons.toLocaleString()} cartons
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm text-indigo-600">{formatCurrency(group.total_value)}</p>
                          <p className="text-xs text-muted-foreground">month total</p>
                        </div>
                      </div>
                    </button>

                    {/* Orders list */}
                    {expanded && (
                      <div className="border-t divide-y">
                        {group.orders.map((o) => (
                          <Link
                            key={o.id}
                            href={`/requests/${o.id}`}
                            className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-bold shrink-0 text-muted-foreground">
                                #{o.id}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{o.route || "—"}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {o.driver_name && `${o.driver_name} · `}
                                  {o.truck_number || ""}
                                  {" · "}
                                  {formatDate(o.request_date || o.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium">{formatCurrency(Number(o.total_value))}</p>
                                <p className="text-xs text-muted-foreground">{Number(o.total_cartons).toLocaleString()} cartons</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded capitalize ${STATUS_COLORS[o.status] || "bg-muted text-muted-foreground"}`}>
                                {o.status}
                              </span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
