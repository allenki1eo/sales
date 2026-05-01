"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  Users,
  Package,
  TrendingUp,
  Calendar,
  FilePlus,
  ArrowRight,
  Trophy,
  ShoppingCart,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { RevenueBreakdownChart } from "@/components/dashboard/revenue-breakdown-chart";
import { TopRoutesChart } from "@/components/dashboard/top-routes-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface DashboardData {
  stats: {
    pending_requests: number;
    approved_requests: number;
    total_customers: number;
    total_products: number;
    total_revenue: number;
    monthly_revenue: number;
    monthly_cartons: number;
  };
  trend: Array<{ month: string; revenue: number; cartons: number }>;
  topProducts: Array<{ product_id: number; product_name: string; total_revenue: number; total_cartons: number }>;
  topCustomers: Array<{ customer_id: number; customer_name: string; total_revenue: number; total_orders: number }>;
  recentRequests: Array<{
    id: number; status: string; truck_number: string; route: string;
    created_at: string; customer_name: string; user_name: string;
  }>;
  exportVsLocal: Array<{ is_export: number; revenue: number; cartons: number; orders: number }>;
  topRoutes: Array<{ route: string; cartons: number; revenue: number; orders: number }>;
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  dispatched: { label: "Dispatched", className: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

function generateMonthOptions() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const months = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?month=${selectedMonth}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          toast.error(d.error || "Failed to load dashboard");
          setData(null);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch(() => { setData(null); setLoading(false); });
  }, [selectedMonth]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">East African Spirit (T) Ltd</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/requests/new">
              <FilePlus className="h-4 w-4" />
              New Request
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending Requests"
          value={stats.pending_requests}
          icon={Clock}
          color="amber"
          subtitle="Awaiting approval"
        />
        <StatCard
          title="Approved Requests"
          value={stats.approved_requests}
          icon={CheckCircle2}
          color="emerald"
          subtitle="Ready to dispatch"
        />
        <StatCard
          title="Total Customers"
          value={stats.total_customers}
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Products"
          value={stats.total_products}
          icon={Package}
          color="purple"
        />
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Revenue (All Time)"
          value={formatCurrency(stats.total_revenue)}
          icon={TrendingUp}
          color="indigo"
          subtitle="All approved & dispatched"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(stats.monthly_revenue)}
          icon={TrendingUp}
          color="emerald"
          subtitle={months.find((m) => m.value === selectedMonth)?.label}
        />
        <StatCard
          title="Monthly Cartons"
          value={stats.monthly_cartons.toLocaleString()}
          icon={ShoppingCart}
          color="blue"
          subtitle="Cartons sold this month"
        />
      </div>

      {/* Sales Trend (full width) */}
      <SalesChart data={data.trend} />

      {/* Market breakdown + Top routes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdownChart data={data.exportVsLocal} />
        <TopRoutesChart data={data.topRoutes} />
      </div>

      {/* Top Products + Top Customers */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-3 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Top Products */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Top Products
              </CardTitle>
              <CardDescription>By revenue (approved/dispatched)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topProducts.map((p, i) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(p.total_revenue)} · {p.total_cartons} cartons
                    </p>
                  </div>
                </div>
              ))}
              {!data.topProducts.length && (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                Top Customers
              </CardTitle>
              <CardDescription>By revenue (approved/dispatched)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topCustomers.map((c, i) => (
                <div key={c.customer_id} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(c.total_revenue)} · {c.total_orders} orders
                    </p>
                  </div>
                </div>
              ))}
              {!data.topCustomers.length && (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Requests</CardTitle>
            <CardDescription>Latest 10 sales requests</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/requests">
              View all <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.recentRequests.map((r) => {
              const cfg = statusConfig[r.status as keyof typeof statusConfig] || statusConfig.pending;
              return (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
                      #{r.id}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.customer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.route} · {r.truck_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${cfg.className}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDate(r.created_at)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
            {!data.recentRequests.length && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No requests found
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
