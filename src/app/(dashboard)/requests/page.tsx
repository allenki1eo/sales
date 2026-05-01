"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Search, FilePlus, Eye, Pencil, Trash2, ChevronLeft,
  ChevronRight, Filter, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  dispatched: "secondary",
  rejected: "destructive",
};

const statusColors: Record<string, string> = {
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
  dispatched: "text-blue-700 bg-blue-50 border-blue-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
};

export default function RequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        search,
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      const res = await fetch(`/api/requests?${params}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load requests");
        setRequests([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      setRequests(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/requests/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Request deleted");
      fetchRequests();
    } else {
      toast.error("Failed to delete request");
    }
    setDeleteId(null);
  };

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

      <Card>
        <CardHeader className="pb-3">
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
                {search || statusFilter !== "all" ? "Try different filters" : "Create your first request"}
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
                            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                              <Link href={`/requests/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                            </Button>
                            {session?.user?.role === "admin" && (
                              <>
                                <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                                  <Link href={`/requests/${r.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
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
                    <div className="text-xs text-muted-foreground flex gap-4">
                      <span>{r.route}</span>
                      <span>{r.truck_number}</span>
                      <span>{formatDate(r.created_at)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                        <Link href={`/requests/${r.id}`}><Eye className="h-3 w-3 mr-1" />View</Link>
                      </Button>
                      {session?.user?.role === "admin" && (
                        <>
                          <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                            <Link href={`/requests/${r.id}/edit`}><Pencil className="h-3 w-3 mr-1" />Edit</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
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
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
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
