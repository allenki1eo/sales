"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Trash2, Loader2, Search, ChevronDown,
  TruckIcon, User, MapPin, Package, CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Customer {
  id: number; name: string; location: string; phone: string;
  is_export: boolean; charges_efd: boolean; efd_profit_per_carton: number;
}
interface Product { id: number; name: string; default_price: number; carton_weight: number; }
interface CustomerPrice { product_id: number; product_name: string; price: number; }

const schema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  request_date: z.string().min(1, "Request date is required"),
  truck_number: z.string().min(1, "Truck number is required"),
  driver_name: z.string().min(1, "Driver name is required"),
  route: z.string().min(1, "Route is required"),
  items: z.array(z.object({
    product_id: z.string().min(1, "Product is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unit_price: z.number().min(0, "Price must be positive"),
  })).min(1, "At least one product is required"),
});

type FormData = z.infer<typeof schema>;

export default function NewRequestPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerPrices, setCustomerPrices] = useState<CustomerPrice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      request_date: localToday,
      items: [{ product_id: "", quantity: 1, unit_price: 0 }],
    },
  });

  const watchedDate = watch("request_date");

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  useEffect(() => {
    Promise.all([
      fetch("/api/customers?all=true").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([c, p]) => { setCustomers(c); setProducts(p); });
  }, []);

  const handleCustomerSelect = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setValue("customer_id", String(customer.id));
    setCustomerSearch(customer.name);
    setShowCustomerDropdown(false);

    const prices = await fetch(`/api/customers/${customer.id}/prices`).then((r) => r.json());
    setCustomerPrices(prices);
    setValue("items", [{ product_id: "", quantity: 1, unit_price: 0 }]);
  };

  const handleProductChange = (index: number, productId: string) => {
    const price = customerPrices.find((cp) => String(cp.product_id) === productId)?.price
      ?? products.find((p) => String(p.id) === productId)?.default_price ?? 0;
    setValue(`items.${index}.product_id`, productId);
    setValue(`items.${index}.unit_price`, price);
  };

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.location.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const grossTotal = watchedItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  const isExport = selectedCustomer?.is_export;
  const subtotal = isExport ? grossTotal : grossTotal / 1.18;
  const vatAmount = isExport ? 0 : subtotal * 0.18;
  const totalCartons = watchedItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const efdCharge = selectedCustomer?.charges_efd
    ? totalCartons * (selectedCustomer.efd_profit_per_carton || 0)
    : 0;
  const total = grossTotal + efdCharge;

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: parseInt(data.customer_id),
          request_date: data.request_date,
          truck_number: data.truck_number,
          driver_name: data.driver_name,
          route: data.route,
          items: data.items.map((i) => ({
            product_id: parseInt(i.product_id),
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });

      if (res.ok) {
        const { id } = await res.json();
        toast.success("Request created successfully");
        router.push(`/requests/${id}`);
      } else {
        toast.error("Failed to create request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Sales Request</h1>
        <p className="text-sm text-muted-foreground">Create a new delivery request</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-600" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Label>Select Customer</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer by name or location..."
                  className="pl-9 pr-9"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-popover shadow-lg max-h-64 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 text-left transition-colors"
                      onClick={() => handleCustomerSelect(c)}
                    >
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />{c.location}
                          {c.phone && <span>· {c.phone}</span>}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {c.is_export && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Export</span>
                        )}
                        {c.charges_efd && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">EFD</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <input type="hidden" {...register("customer_id")} />
              {errors.customer_id && <p className="text-xs text-destructive mt-1">{errors.customer_id.message}</p>}
            </div>

            {selectedCustomer && (
              <div className="mt-3 flex gap-2 flex-wrap">
                <span className="text-xs bg-muted px-2 py-1 rounded-md flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{selectedCustomer.location}
                </span>
                <span className={`text-xs px-2 py-1 rounded-md ${selectedCustomer.is_export ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {selectedCustomer.is_export ? "Export (No VAT)" : "Local (18% VAT)"}
                </span>
                {selectedCustomer.charges_efd && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
                    EFD: TZS {selectedCustomer.efd_profit_per_carton}/carton
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-indigo-600" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Request Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !watchedDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watchedDate ? format(new Date(watchedDate + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={watchedDate ? new Date(watchedDate + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (!d) return;
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      setValue("request_date", `${yyyy}-${mm}-${dd}`);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.request_date && <p className="text-xs text-destructive">{errors.request_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="truck_number">Truck Number</Label>
              <Input id="truck_number" placeholder="e.g. T123ABC" {...register("truck_number")} />
              {errors.truck_number && <p className="text-xs text-destructive">{errors.truck_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver_name">Driver Name</Label>
              <Input id="driver_name" placeholder="Driver's full name" {...register("driver_name")} />
              {errors.driver_name && <p className="text-xs text-destructive">{errors.driver_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="route">Route</Label>
              <Input id="route" placeholder="e.g. Dar es Salaam" {...register("route")} />
              {errors.route && <p className="text-xs text-destructive">{errors.route.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600" />
              Products
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ product_id: "", quantity: 1, unit_price: 0 })}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Product
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <Label className="text-xs">Product</Label>
                    <Select
                      onValueChange={(v) => handleProductChange(index, v)}
                      value={watchedItems[index]?.product_id || ""}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.items?.[index]?.product_id && (
                      <p className="text-xs text-destructive">{errors.items[index]?.product_id?.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quantity (cartons)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="0"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Price (TZS, excl. VAT)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="pt-6 shrink-0">
                  <div className="text-sm font-medium text-right mb-1">
                    {formatCurrency((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unit_price || 0))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {errors.items?.root && (
              <p className="text-xs text-destructive">{errors.items.root.message}</p>
            )}

            {/* Totals */}
            <Separator />
            <div className="space-y-1 ml-auto max-w-xs">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (excl. VAT)</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {!isExport && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT (18%)</span>
                  <span className="font-medium">{formatCurrency(vatAmount)}</span>
                </div>
              )}
              {selectedCustomer?.charges_efd && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    EFD Charge ({formatCurrency(selectedCustomer.efd_profit_per_carton)}/ctn × {totalCartons.toLocaleString()} ctns)
                  </span>
                  <span className="font-medium">{formatCurrency(efdCharge)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total {isExport ? "" : "(Incl. VAT)"}</span>
                <span className="text-indigo-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</>
            ) : (
              "Create Request"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
