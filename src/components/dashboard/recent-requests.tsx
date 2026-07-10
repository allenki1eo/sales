"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export interface RecentRequest {
  id: number;
  status: string;
  truck_number: string;
  route: string;
  created_at: string;
  customer_name: string;
  user_name: string;
}

const statusConfig = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  dispatched: { label: "Dispatched", className: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

export function RecentRequests({ requests }: { requests: RecentRequest[] }) {
  return (
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
          {requests.map((r) => {
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
          {!requests.length && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No requests found
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
