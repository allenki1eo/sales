"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface RouteData {
  route: string;
  cartons: number;
  revenue: number;
  orders: number;
}

interface Props {
  data: RouteData[];
}

function truncate(s: string, max = 14) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function TopRoutesChart({ data }: Props) {
  const chartData = data.map((d) => ({
    route:   truncate(d.route),
    fullRoute: d.route,
    cartons: Number(d.cartons),
    revenue: Number(d.revenue),
    orders:  Number(d.orders),
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top Routes by Volume</CardTitle>
        <CardDescription>Cartons dispatched per route (top 8)</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <YAxis
                type="category"
                dataKey="route"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={88}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                formatter={(value: number, _name: string, props: any) => [
                  `${Number(value).toLocaleString()} cartons`,
                  props.payload.fullRoute,
                ]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
              />
              <Bar dataKey="cartons" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
