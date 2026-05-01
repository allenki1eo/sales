"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Package, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Product {
  id: number; name: string; default_price: number; carton_weight: number; created_at: string;
}

const productSchema = z.object({
  name: z.string().min(1, "Name required"),
  default_price: z.number().min(0, "Price must be positive"),
  carton_weight: z.number().min(0).default(0),
});
type ProductForm = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { default_price: 0, carton_weight: 0 },
  });

  const fetchProducts = () => {
    setLoading(true);
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => { setProducts(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openEdit = (p: Product) => {
    setEditProduct(p);
    reset({ name: p.name, default_price: Number(p.default_price), carton_weight: Number(p.carton_weight) });
    setShowDialog(true);
  };

  const openAdd = () => {
    setEditProduct(null);
    reset({ name: "", default_price: 0, carton_weight: 0 });
    setShowDialog(true);
  };

  const onSubmit = async (data: ProductForm) => {
    setSubmitting(true);
    try {
      const url = editProduct ? `/api/products/${editProduct.id}` : "/api/products";
      const method = editProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success(editProduct ? "Product updated" : "Product added");
        setShowDialog(false);
        fetchProducts();
      } else {
        toast.error("Operation failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{products.length} products</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No products yet</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product Name</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Default Price (excl. VAT)</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Carton Weight (kg)</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.default_price)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{p.carton_weight} kg</td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(p.default_price)} · {p.carton_weight} kg/carton</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product Name</Label>
              <Input placeholder="e.g. D-PET 500ml" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Default Price (TZS, excl. VAT)</Label>
              <Input type="number" min="0" step="0.01" {...register("default_price", { valueAsNumber: true })} />
              {errors.default_price && <p className="text-xs text-destructive">{errors.default_price.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Carton Weight (kg)</Label>
              <Input type="number" min="0" step="0.1" {...register("carton_weight", { valueAsNumber: true })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editProduct ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
