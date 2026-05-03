import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: "indigo" | "emerald" | "amber" | "rose" | "blue" | "purple";
  className?: string;
}

const colorMap = {
  indigo: {
    bg: "bg-indigo-50",
    icon: "bg-indigo-600 text-white",
    border: "border-l-indigo-500",
    trend: "text-indigo-600",
  },
  emerald: {
    bg: "bg-emerald-50",
    icon: "bg-emerald-600 text-white",
    border: "border-l-emerald-500",
    trend: "text-emerald-600",
  },
  amber: {
    bg: "bg-amber-50",
    icon: "bg-amber-500 text-white",
    border: "border-l-amber-500",
    trend: "text-amber-600",
  },
  rose: {
    bg: "bg-rose-50",
    icon: "bg-rose-600 text-white",
    border: "border-l-rose-500",
    trend: "text-rose-600",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-600 text-white",
    border: "border-l-blue-500",
    trend: "text-blue-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "bg-purple-600 text-white",
    border: "border-l-purple-500",
    trend: "text-purple-600",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "indigo",
  className,
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <Card className={cn("border-l-4", colors.border, className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="mt-1 text-lg sm:text-2xl font-bold tracking-tight break-all leading-tight">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ml-3", colors.icon)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
