"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface SegmentData {
  is_export: number | boolean;
  revenue: number;
  cartons: number;
  orders: number;
}

interface Props {
  data: SegmentData[];
}

const COLORS = ["#4f46e5", "#10b981"];

export function RevenueBreakdownChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name:    Number(d.is_export) === 1 ? "Export" : "Local",
    revenue: Number(d.revenue),
    cartons: Number(d.cartons),
    orders:  Number(d.orders),
  }));

  const total = chartData.reduce((s, d) => s + d.revenue, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Revenue by Market</CardTitle>
        <CardDescription>Export vs local customer split (approved/dispatched)</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={46}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {chartData.map((d, i) => (
                <div key={d.name} className="rounded-lg p-3 text-center" style={{ backgroundColor: `${COLORS[i % COLORS.length]}15` }}>
                  <p className="text-xs font-medium" style={{ color: COLORS[i % COLORS.length] }}>{d.name}</p>
                  <p className="text-sm font-bold mt-0.5">{((d.revenue / total) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{d.orders} orders · {d.cartons.toLocaleString()} cartons</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
