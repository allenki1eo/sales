"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FileMinus2, Plus, Search, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface CreditNoteRow {
  id: number;
  credit_note_no: string;
  status: string;
  reason: string;
  credit_date: string;
  customer_name: string;
  user_name: string;
  total_amount: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function CreditNotesPage() {
  const { data: session } = useSession();
  const canCreate = ["admin", "accountant"].includes(session?.user?.role ?? "");

  const [rows, setRows]         = useState<CreditNoteRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("all");
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/credit-notes?${params}`);
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.error || "Failed to load credit notes");
    } else {
      setRows(d.data);
      setTotalPages(d.totalPages || 1);
    }
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileMinus2 className="h-6 w-6 text-rose-500" />
            Credit Notes
          </h1>
          <p className="text-sm text-muted-foreground">
            Returns, damages and overcharge corrections issued to customers
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/credit-notes/new">
              <Plus className="h-4 w-4" />
              New Credit Note
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer, number or reason..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
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
              No credit notes found
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((cn) => (
                <Link
                  key={cn.id}
                  href={`/credit-notes/${cn.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{cn.credit_note_no}</p>
                    <p className="text-sm truncate">{cn.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{cn.reason}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-3">
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(Number(cn.total_amount))}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(cn.credit_date)}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[cn.status] || STATUS_STYLES.pending}`}>
                      {cn.status.charAt(0).toUpperCase() + cn.status.slice(1)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
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
