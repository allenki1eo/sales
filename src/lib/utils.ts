import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calculateVAT(amountExclVAT: number, vatRate = 0.18): number {
  return amountExclVAT * vatRate;
}

export function addVAT(amountExclVAT: number, vatRate = 0.18): number {
  return amountExclVAT * (1 + vatRate);
}

export function calculateEFDCharge(
  quantity: number,
  efdProfitPerCarton: number,
  vatRate = 0.18
): number {
  return quantity * efdProfitPerCarton * vatRate;
}

export function getStatusColor(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "dispatched":
      return "secondary";
    case "rejected":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
}
