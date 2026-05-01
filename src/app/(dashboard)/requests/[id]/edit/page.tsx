"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Product { id: number; name: string; default_price: number; }

const schema = z.object({
  truck_number: z.string().min(1),
  driver_name: z.string().min(1),
  route: z.string().min(1),
  status: z.string(),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().min(1),
    unit_price: z.number().min(0),
  })).min(1),
});

type FormData = z.infer<typeof schema>;

export default function EditRequestPage() {
  const params = useParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items") || [];

  useEffect(() => {
    Promise.all([
      fetch(`/api/requests/${params.id}`).then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([req, prods]) => {
      setProducts(prods);
      reset({
        truck_number: req.truck_number,
        driver_name: req.driver_name,
        route: req.route,
        status: req.status,
        items: req.items.map((i: { product_id: number; quantity: number; unit_price: number }) => ({
          product_id: String(i.product_id),
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
        })),
      });
      setLoaded(true);
    });
  }, [params.id, reset]);

  const subtotal = watchedItems.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          items: data.items.map((i) => ({
            product_id: parseInt(i.product_id),
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });
      if (res.ok) {
        toast.success("Request updated");
        router.push(`/requests/${params.id}`);
      } else {
        toast.error("Update failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Edit Request #{params.id}</h1>
          <p className="text-sm text-muted-foreground">Modify delivery details and products</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Delivery Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Truck Number</Label>
              <Input {...register("truck_number")} />
              {errors.truck_number && <p className="text-xs text-destructive">{errors.truck_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Driver Name</Label>
              <Input {...register("driver_name")} />
            </div>
            <div className="space-y-1.5">
              <Label>Route</Label>
              <Input {...register("route")} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select onValueChange={(v) => setValue("status", v)} defaultValue={watch("status")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Products</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: "", quantity: 1, unit_price: 0 })}>
              <Plus className="h-4 w-4 mr-1" />Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Product</Label>
                    <Select
                      onValueChange={(v) => setValue(`items.${index}.product_id`, v)}
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
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input type="number" min="1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                  </div>
                  <div>
                    <Label className="text-xs">Unit Price</Label>
                    <Input type="number" min="0" step="0.01" {...register(`items.${index}.unit_price`, { valueAsNumber: true })} />
                  </div>
                </div>
                <div className="pt-5">
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
            <Separator />
            <div className="text-right">
              <span className="text-sm text-muted-foreground mr-3">Subtotal:</span>
              <span className="font-bold text-indigo-600">{formatCurrency(subtotal)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
