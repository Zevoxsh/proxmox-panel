import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    RUNNING: "text-green-400",
    STOPPED: "text-red-400",
    PENDING: "text-yellow-400",
    SUSPENDED: "text-orange-400",
    ERROR: "text-red-600",
    DELETING: "text-gray-400",
  };
  return map[status] ?? "text-gray-400";
}

export function getStatusBg(status: string): string {
  const map: Record<string, string> = {
    RUNNING: "bg-green-400/10 text-green-400 ring-green-400/20",
    STOPPED: "bg-red-400/10 text-red-400 ring-red-400/20",
    PENDING: "bg-yellow-400/10 text-yellow-400 ring-yellow-400/20",
    SUSPENDED: "bg-orange-400/10 text-orange-400 ring-orange-400/20",
    ERROR: "bg-red-600/10 text-red-600 ring-red-600/20",
    DELETING: "bg-gray-400/10 text-gray-400 ring-gray-400/20",
    ACTIVE: "bg-green-400/10 text-green-400 ring-green-400/20",
    CANCELED: "bg-red-400/10 text-red-400 ring-red-400/20",
    PAST_DUE: "bg-orange-400/10 text-orange-400 ring-orange-400/20",
    PAID: "bg-green-400/10 text-green-400 ring-green-400/20",
    OPEN: "bg-blue-400/10 text-blue-400 ring-blue-400/20",
    VOID: "bg-gray-400/10 text-gray-400 ring-gray-400/20",
  };
  return map[status] ?? "bg-gray-400/10 text-gray-400 ring-gray-400/20";
}
