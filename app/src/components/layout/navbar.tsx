"use client";

import { Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api";

interface NavbarProps {
  userName?: string | null;
  userEmail?: string | null;
  title?: string;
  isAdmin?: boolean;
}

export function Navbar({ userName, userEmail, isAdmin }: NavbarProps) {
  const handleLogout = async () => {
    await fetch(`${getApiBaseUrl()}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };
  const initials =
    userName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  return (
    <header className="h-[60px] flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-end px-6 gap-3">
      {isAdmin && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/14 transition-colors"
        >
          <Shield className="h-3 w-3" />
          Admin
        </Link>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full ring-2 ring-transparent hover:ring-primary/30 transition-all">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="pb-2">
            <p className="font-semibold text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground font-normal mt-0.5">{userEmail}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/billing" className="cursor-pointer">Facturation</Link>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer text-primary">Panel Admin</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            onClick={handleLogout}
          >
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
