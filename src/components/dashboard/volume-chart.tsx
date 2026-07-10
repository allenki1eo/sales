"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface MonthlyVolume {
  month: string;
  cartons: number;
}

interface VolumeChartProps {
  data: MonthlyVolume[];
}

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function VolumeChart({ data }: VolumeChartProps) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    cartons: Number(d.cartons),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume Trend</CardTitle>
        <CardDescription>Cartons sold over the last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()} cartons`, "Cartons"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
            />
            <Bar
              dataKey="cartons"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
