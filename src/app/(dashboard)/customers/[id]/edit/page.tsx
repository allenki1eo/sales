"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  location: z.string().min(1, "Location required"),
  phone: z.string().optional(),
  is_export: z.boolean().default(false),
  charges_efd: z.boolean().default(false),
  efd_profit_per_carton: z.number().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const watchEfd = watch("charges_efd");

  useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then((r) => r.json())
      .then((c) => {
        reset({
          name: c.name,
          location: c.location,
          phone: c.phone || "",
          is_export: !!c.is_export,
          charges_efd: !!c.charges_efd,
          efd_profit_per_carton: Number(c.efd_profit_per_carton) || 0,
        });
        setLoaded(true);
      })
      .catch(() => { toast.error("Customer not found"); router.push("/customers"); });
  }, [params.id, reset, router]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/customers/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Customer updated");
        router.push(`/customers/${params.id}`);
      } else {
        toast.error("Update failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Edit Customer</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input {...register("location")} />
                {errors.location && <p className="text-xs text-destructive">{errors.location.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...register("phone")} />
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" {...register("is_export")} />
                <div>
                  <p className="text-sm font-medium">Export Customer</p>
                  <p className="text-xs text-muted-foreground">No VAT on prices</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  {...register("charges_efd")}
                  onChange={(e) => { setValue("charges_efd", e.target.checked); if (!e.target.checked) setValue("efd_profit_per_carton", 0); }}
                />
                <div>
                  <p className="text-sm font-medium">Charges EFD</p>
                  <p className="text-xs text-muted-foreground">EFD machine surcharge</p>
                </div>
              </label>
              {watchEfd && (
                <div className="space-y-1.5 ml-7">
                  <Label className="text-xs">EFD Profit per Carton (TZS)</Label>
                  <Input type="number" min="0" step="0.01" {...register("efd_profit_per_carton", { valueAsNumber: true })} />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
