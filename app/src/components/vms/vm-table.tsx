"use client";

import Link from "next/link";
import { Server, ArrowRight } from "lucide-react";
import { VMStatusBadge } from "./vm-status-badge";
import { formatBytes } from "@/lib/utils";

interface VM {
  id: string;
  vmid: number;
  name: string;
  type: string;
  status: string;
  ip: string | null;
  os?: string | null;
  createdAt?: Date | string;
  plan: { name: string; cpu: number; ramMb: number; diskGb: number };
  node: { name: string };
}

export function VMTable({ vms }: { vms: VM[] }) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Machine
            </th>
            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Statut
            </th>
            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
              IP
            </th>
            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
              Plan
            </th>
            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
              Node
            </th>
            <th className="px-5 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {vms.map((vm) => (
            <tr
              key={vm.id}
              className="hover:bg-accent/30 transition-colors group"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0 border border-primary/15">
                    <Server className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-primary transition-colors">{vm.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {vm.type} · {vm.vmid}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <VMStatusBadge status={vm.status} />
              </td>
              <td className="px-5 py-3.5 hidden md:table-cell">
                <span className="font-mono text-xs text-muted-foreground">
                  {vm.ip ?? <span className="text-muted-foreground/50">DHCP</span>}
                </span>
              </td>
              <td className="px-5 py-3.5 hidden lg:table-cell">
                <p className="text-sm font-medium">{vm.plan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {vm.plan.cpu} vCPU · {formatBytes(vm.plan.ramMb)}
                </p>
              </td>
              <td className="px-5 py-3.5 hidden lg:table-cell">
                <span className="text-xs text-muted-foreground">{vm.node.name}</span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link
                  href={`/vms/${vm.id}`}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
