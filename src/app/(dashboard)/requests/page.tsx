"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { DateRange } from "react-day-picker";
import {
  Search, FilePlus, Eye, Pencil, Trash2, ChevronLeft,
  ChevronRight, Filter, FileText, CheckCircle, CalendarIcon, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface RequestRow {
  id: number; status: string; truck_number: string; driver_name: string;
  route: string; created_at: string; customer_name: string; customer_location: string;
  user_name: string;
}

const statusColors: Record<string, string> = {
  pending:    "text-amber-700 bg-amber-50 border-amber-200",
  approved:   "text-emerald-700 bg-emerald-50 border-emerald-200",
  dispatched: "text-blue-700 bg-blue-50 border-blue-200",
  rejected:   "text-red-700 bg-red-50 border-red-200",
};

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function RequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests]         = useState<RequestRow[]>([]);
  const [total, setTotal]               = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange]       = useState<DateRange | undefined>();
  const [calOpen, setCalOpen]           = useState(false);
  const [loading, setLoading]           = useState(true);
  const [deleteId, setDeleteId]         = useState<number | null>(null);
  const [approvingId, setApprovingId]   = useState<number | null>(null);

  const role       = session?.user?.role;
  const canApprove = role === "admin" || role === "accountant";

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: "10", search,
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(dateRange?.from && { from: toISO(dateRange.from) }),
        ...(dateRange?.to   && { to:   toISO(dateRange.to)   }),
      });
      const [res, pendingRes] = await Promise.all([
        fetch(`/api/requests?${params}`),
        fetch("/api/requests?limit=1&status=pending"),
      ]);
      const data        = await res.json();
      const pendingData = await pendingRes.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load requests");
        setRequests([]); setTotal(0); setTotalPages(1);
        return;
      }
      setRequests(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPendingCount(pendingData.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateRange]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const clearDateRange = () => { setDateRange(undefined); setPage(1); };

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      const res  = await fetch(`/api/requests/${id}/sign`, { method: "POST" });
      const data = await res.json();
      if (res.ok) { toast.success(`Request #${id} approved`); fetchRequests(); }
      else toast.error(data.error || "Failed to approve");
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/requests/${deleteId}`, { method: "DELETE" });
    if (res.ok) { toast.success("Request deleted"); fetchRequests(); }
    else toast.error("Failed to delete request");
    setDeleteId(null);
  };

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`
      : fmtDate(dateRange.from)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Requests</h1>
          <p className="text-sm text-muted-foreground">{total} total requests</p>
        </div>
        <Button asChild>
          <Link href="/requests/new">
            <FilePlus className="h-4 w-4" />
            New Request
          </Link>
        </Button>
      </div>

      {/* Pending banner */}
      {canApprove && pendingCount > 0 && (
        <button
          onClick={() => { setStatusFilter("pending"); setPage(1); }}
          className="w-full flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
              <CheckCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pendingCount} request{pendingCount !== 1 ? "s" : ""} awaiting approval
              </p>
              <p className="text-xs text-amber-700">Click to filter pending requests</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-200 px-2 py-1 rounded-full">
            {pendingCount}
          </span>
        </button>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            {/* Row 1: search + status */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer, route, truck..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: date range picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`justify-start text-left font-normal h-9 ${!dateLabel ? "text-muted-foreground" : ""}`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {dateLabel ?? "Filter by date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      setPage(1);
                      if (range?.from && range?.to) setCalOpen(false);
                    }}
                    numberOfMonths={2}
                    disabled={{ after: new Date() }}
                    initialFocus
                  />
                  <div className="border-t p-3 flex justify-between items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {dateRange?.from && !dateRange?.to ? "Select end date" : "Select a date range"}
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => { clearDateRange(); setCalOpen(false); }}>
                      Clear
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Active date badge */}
              {dateLabel && (
                <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-full">
                  <CalendarIcon className="h-3 w-3" />
                  {dateLabel}
                  <button onClick={clearDateRange} className="ml-0.5 hover:text-indigo-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">No requests found</p>
              <p className="text-sm mt-1">
                {search || statusFilter !== "all" || dateLabel
                  ? "Try different filters"
                  : "Create your first request"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Route</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Truck</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-indigo-600">#{r.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{r.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{r.customer_location}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{r.route}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.truck_number}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${statusColors[r.status] || ""}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(r.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canApprove && r.status === "pending" && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleApprove(r.id)}
                                disabled={approvingId === r.id}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {approvingId === r.id ? "…" : "Approve"}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link href={`/requests/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                            </Button>
                            {role === "admin" && (
                              <>
                                <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                  <Link href={`/requests/${r.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteId(r.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {requests.map((r) => (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-600 mr-2">#{r.id}</span>
                        <span className="font-medium">{r.customer_name}</span>
                      </div>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${statusColors[r.status] || ""}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                      <span>{r.route}</span>
                      <span>{r.truck_number}</span>
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {canApprove && r.status === "pending" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApprove(r.id)}
                          disabled={approvingId === r.id}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {approvingId === r.id ? "Approving…" : "Approve"}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <Link href={`/requests/${r.id}`}><Eye className="h-3 w-3 mr-1" />View</Link>
                      </Button>
                      {role === "admin" && (
                        <>
                          <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                            <Link href={`/requests/${r.id}/edit`}><Pencil className="h-3 w-3 mr-1" />Edit</Link>
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(r.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
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

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Request #{deleteId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All items and signatures will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
