"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, CheckCircle2, XCircle, Trash2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface CreditNoteItem {
  id: number;
  product_id: number | null;
  product_name: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CreditNote {
  id: number;
  credit_note_no: string;
  customer_id: number;
  request_id: number | null;
  reason: string;
  status: string;
  credit_date: string;
  created_at: string;
  approved_at: string | null;
  customer_name: string;
  customer_location: string;
  customer_phone: string;
  is_export: number;
  user_name: string;
  approved_by_name: string | null;
  items: CreditNoteItem[];
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function CreditNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [note, setNote]       = useState<CreditNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/credit-notes/${params.id}`);
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.error || "Failed to load credit note");
      setNote(null);
    } else {
      setNote(d);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (status: "approved" | "rejected") => {
    setActing(true);
    const res = await fetch(`/api/credit-notes/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    setActing(false);
    if (!res.ok) toast.error(d.error || "Failed to update credit note");
    else {
      toast.success(`Credit note ${status}`);
      load();
    }
  };

  const handleDelete = async () => {
    setActing(true);
    const res = await fetch(`/api/credit-notes/${params.id}`, { method: "DELETE" });
    const d = await res.json();
    setActing(false);
    if (!res.ok) toast.error(d.error || "Failed to delete credit note");
    else {
      toast.success("Credit note deleted");
      router.push("/credit-notes");
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-10 w-64 rounded-lg bg-muted" />
        <div className="h-48 rounded-xl bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    );
  }

  if (!note) return null;

  const total = note.items.reduce((s, it) => s + Number(it.total_price), 0);

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-6 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/credit-notes"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{note.credit_note_no}</h1>
              <p className="text-sm text-muted-foreground">
                Prepared by {note.user_name} · {formatDate(note.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[note.status]}`}>
              {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
            </span>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Customer</p>
              <p className="font-medium">{note.customer_name}</p>
              {note.customer_location && <p className="text-xs text-muted-foreground">{note.customer_location}</p>}
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Credit date</p>
              <p className="font-medium">{formatDate(note.credit_date)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-muted-foreground text-xs">Reason</p>
              <p className="font-medium">{note.reason}</p>
            </div>
            {note.request_id && (
              <div>
                <p className="text-muted-foreground text-xs">Related order</p>
                <Link href={`/requests/${note.request_id}`} className="font-medium text-indigo-600 hover:underline">
                  Request #{note.request_id}
                </Link>
              </div>
            )}
            {note.approved_by_name && (
              <div>
                <p className="text-muted-foreground text-xs">
                  {note.status === "approved" ? "Approved by" : "Rejected by"}
                </p>
                <p className="font-medium">
                  {note.approved_by_name}
                  {note.approved_at ? ` · ${formatDate(note.approved_at)}` : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Credit Lines</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {note.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {it.product_name || it.description || "Adjustment"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(it.quantity).toLocaleString()} × {formatCurrency(Number(it.unit_price))}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0 ml-3">{formatCurrency(Number(it.total_price))}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t mt-4 pt-4">
              <p className="font-semibold">Total credit</p>
              <p className="text-lg font-bold text-rose-600">{formatCurrency(total)}</p>
            </div>
          </CardContent>
        </Card>

        {isAdmin && note.status === "pending" && (
          <div className="flex flex-wrap justify-end gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600" disabled={acting}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this credit note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {note.credit_note_no} will be permanently removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" className="text-red-600" onClick={() => setStatus("rejected")} disabled={acting}>
              <XCircle className="h-4 w-4" /> Reject
            </Button>
            <Button onClick={() => setStatus("approved")} disabled={acting}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </div>
        )}
        {!isAdmin && note.status === "pending" && (
          <p className="text-sm text-muted-foreground text-center">
            Awaiting admin approval — this credit note does not affect the customer&apos;s balance yet.
          </p>
        )}
      </div>

      {/* ── PRINT DOCUMENT ── hidden on screen, shown when printing ── */}
      <div className="hidden print-only">
        <div className="p-8 text-black">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-xl font-bold uppercase">East African Spirit (T) Ltd</h1>
            <p className="text-sm mt-1 font-semibold uppercase tracking-wider">Credit Note</p>
          </div>

          <div className="flex justify-between text-sm mb-6">
            <div>
              <p><span className="font-semibold">Credit Note No:</span> {note.credit_note_no}</p>
              <p><span className="font-semibold">Date:</span> {formatDate(note.credit_date)}</p>
              {note.request_id && <p><span className="font-semibold">Ref. Order:</span> #{note.request_id}</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold">{note.customer_name}</p>
              {note.customer_location && <p>{note.customer_location}</p>}
              {note.customer_phone && <p>{note.customer_phone}</p>}
            </div>
          </div>

          <p className="text-sm mb-4"><span className="font-semibold">Reason:</span> {note.reason}</p>

          <table className="w-full text-sm border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Amount</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {note.items.map((it) => (
                <tr key={it.id} className="border-b border-gray-300">
                  <td className="py-2">{it.product_name || it.description || "Adjustment"}</td>
                  <td className="py-2 text-right">{Number(it.quantity).toLocaleString()}</td>
                  <td className="py-2 text-right">{Math.round(Number(it.unit_price)).toLocaleString()}</td>
                  <td className="py-2 text-right">{Math.round(Number(it.total_price)).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-black font-bold">
                <td className="py-2" colSpan={3}>TOTAL CREDIT (TZS)</td>
                <td className="py-2 text-right">{Math.round(total).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-between text-sm mt-12">
            <div>
              <p className="border-t border-black pt-1 px-6">Prepared by: {note.user_name}</p>
            </div>
            <div>
              <p className="border-t border-black pt-1 px-6">
                Approved by: {note.approved_by_name || "________________"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
