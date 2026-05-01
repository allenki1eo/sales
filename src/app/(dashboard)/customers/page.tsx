"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Search, Plus, Eye, Pencil, MapPin, Phone,
  ChevronLeft, ChevronRight, Users, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Customer {
  id: number; name: string; location: string; phone: string;
  is_export: boolean; charges_efd: boolean; efd_profit_per_carton: number; created_at: string;
}

const customerSchema = z.object({
  name: z.string().min(1, "Name required"),
  location: z.string().min(1, "Location required"),
  phone: z.string().optional(),
  is_export: z.boolean().default(false),
  charges_efd: z.boolean().default(false),
  efd_profit_per_carton: z.number().min(0).default(0),
});
type CustomerForm = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { is_export: false, charges_efd: false, efd_profit_per_carton: 0 },
  });
  const watchEfd = watch("charges_efd");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10", search });
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const onAddCustomer = async (data: CustomerForm) => {
    setAddLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Customer added");
        setShowAddDialog(false);
        reset();
        fetchCustomers();
      } else {
        toast.error("Failed to add customer");
      }
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{total} total customers</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />Add Customer
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, location, phone..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No customers found</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />{c.location}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <span className={`text-xs px-2 py-0.5 rounded-md ${c.is_export ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                              {c.is_export ? "Export" : "Local"}
                            </span>
                            {c.charges_efd && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">EFD</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link href={`/customers/${c.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                            </Button>
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link href={`/customers/${c.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {customers.map((c) => (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />{c.location}
                        </p>
                        {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{c.phone}</p>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-md ${c.is_export ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {c.is_export ? "Export" : "Local"}
                        </span>
                        {c.charges_efd && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md">EFD</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <Link href={`/customers/${c.id}`}><Eye className="h-3 w-3 mr-1" />Portfolio</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <Link href={`/customers/${c.id}/edit`}><Pencil className="h-3 w-3 mr-1" />Edit</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAddCustomer)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Customer Name</Label>
                <Input placeholder="Full company/person name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="City/Region" {...register("location")} />
                {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="+255..." {...register("phone")} />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" {...register("is_export")} />
                <div>
                  <p className="text-sm font-medium">Export Customer</p>
                  <p className="text-xs text-muted-foreground">No VAT applied to prices</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" {...register("charges_efd")} onChange={(e) => { setValue("charges_efd", e.target.checked); if (!e.target.checked) setValue("efd_profit_per_carton", 0); }} />
                <div>
                  <p className="text-sm font-medium">Charges EFD</p>
                  <p className="text-xs text-muted-foreground">EFD machine surcharge applies</p>
                </div>
              </label>
              {watchEfd && (
                <div className="space-y-1.5 ml-7">
                  <Label className="text-xs">EFD Profit per Carton (TZS)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" {...register("efd_profit_per_carton", { valueAsNumber: true })} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAddDialog(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={addLoading}>
                {addLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Adding...</> : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
