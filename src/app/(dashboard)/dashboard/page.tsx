"use client";

import { useSession } from "next-auth/react";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { TeamDashboard } from "@/components/dashboard/team-dashboard";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
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

  // Only administrators see the financial dashboard; everyone else gets
  // the operations dashboard with no revenue values or margins.
  return session?.user?.role === "admin" ? <AdminDashboard /> : <TeamDashboard />;
}
