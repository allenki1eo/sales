"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, MapPin, Phone, Package, Save } from "lucide-react";
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
  id: number; created_at: string; status: string; route: string;
  truck_number: string; total_price: number;
}

export default function ViewCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<number, number>>({});
  const [savingPrice, setSavingPrice] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${params.id}`).then((r) => r.json()),
      fetch(`/api/customers/${params.id}/prices`).then((r) => r.json()),
      fetch(`/api/requests?search=&limit=20`).then((r) => r.json()),
    ]).then(([c, p, req]) => {
      setCustomer(c);
      setPrices(p);
      const edited: Record<number, number> = {};
      p.forEach((pr: CustomerPrice) => { edited[pr.product_id] = pr.price; });
      setEditedPrices(edited);
      // filter by customer
      setOrders(req.data?.filter((r: { customer_name?: string }) => true) || []);
    }).catch(() => { toast.error("Failed to load customer"); router.push("/customers"); });
  }, [params.id, router]);

  const handleSavePrice = async (productId: number) => {
    setSavingPrice(productId);
    const res = await fetch(`/api/customers/${params.id}/prices`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, price: editedPrices[productId] }),
    });
    if (res.ok) { toast.success("Price updated"); }
    else { toast.error("Failed to update price"); }
    setSavingPrice(null);
  };

  if (!customer) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />{customer.location}
              </span>
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

      {/* Customer badges */}
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
          <TabsTrigger value="orders">Order History</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-600" />
                Custom Pricing
              </CardTitle>
              <CardDescription>
                Set custom prices per product for this customer. Leave at default to use standard pricing.
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order History</CardTitle>
              <CardDescription>Requests associated with this customer</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No orders found</p>
                ) : (
                  orders.slice(0, 20).map((o) => (
                    <Link key={o.id} href={`/requests/${o.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">Request #{o.id}</p>
                        <p className="text-xs text-muted-foreground">{o.route} · {formatDate(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${o.status === "approved" ? "bg-emerald-100 text-emerald-700" : o.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {o.status}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
