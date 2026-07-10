"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  Users,
  Package,
  Calendar,
  FilePlus,
  Trophy,
  ShoppingCart,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { VolumeBreakdownChart } from "@/components/dashboard/volume-breakdown-chart";
import { TopRoutesChart } from "@/components/dashboard/top-routes-chart";
import { RecentRequests, RecentRequest } from "@/components/dashboard/recent-requests";
import { generateMonthOptions } from "@/components/dashboard/dashboard-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface TeamDashboardData {
  stats: {
    pending_requests: number;
    approved_requests: number;
    total_customers: number;
    total_products: number;
    monthly_cartons: number;
    yearly_cartons: number;
  };
  trend: Array<{ month: string; cartons: number }>;
  topProducts: Array<{ product_id: number; product_name: string; total_cartons: number }>;
  topCustomers: Array<{ customer_id: number; customer_name: string; total_cartons: number; total_orders: number }>;
  recentRequests: RecentRequest[];
  exportVsLocal: Array<{ is_export: number; cartons: number; orders: number }>;
  topRoutes: Array<{ route: string; cartons: number; orders: number }>;
}

export function TeamDashboard() {
  const [data, setData] = useState<TeamDashboardData | null>(null);
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

      {/* Operational stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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

      {/* Volume stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <StatCard
          title="Monthly Cartons"
          value={stats.monthly_cartons.toLocaleString()}
          icon={ShoppingCart}
          color="blue"
          subtitle={months.find((m) => m.value === selectedMonth)?.label}
        />
        <StatCard
          title={`${selectedMonth.slice(0, 4)} Cartons`}
          value={stats.yearly_cartons.toLocaleString()}
          icon={ShoppingCart}
          color="emerald"
          subtitle="Cartons sold this year"
        />
      </div>

      {/* Volume Trend (full width) */}
      <VolumeChart data={data.trend} />

      {/* Market breakdown + Top routes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VolumeBreakdownChart data={data.exportVsLocal} />
        <TopRoutesChart data={data.topRoutes} />
      </div>

      {/* Top Products + Top Customers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Products
            </CardTitle>
            <CardDescription>By cartons sold (approved/dispatched)</CardDescription>
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
                    {p.total_cartons.toLocaleString()} cartons
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
            <CardDescription>By orders (approved/dispatched)</CardDescription>
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
                    {c.total_orders} orders · {c.total_cartons.toLocaleString()} cartons
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

      {/* Recent Requests */}
      <RecentRequests requests={data.recentRequests} />
    </div>
  );
}
