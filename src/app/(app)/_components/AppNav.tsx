"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Heart, Settings, LogOut } from "lucide-react";

const navItems = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppNavProps {
  email?: string | null;
  signOutAction: () => Promise<void>;
}

export function AppNav({ email, signOutAction }: AppNavProps) {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden w-56 shrink-0 border-r border-border p-4 md:flex md:flex-col md:gap-1">
        <h2 className="mb-4 text-lg font-semibold">Backlog Odyssey</h2>
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === href
                ? "bg-accent text-accent-foreground font-medium"
                : "hover:bg-accent"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
        <div className="mt-auto">
          <p className="mb-2 truncate text-xs text-muted-foreground">{email}</p>
          <form action={signOutAction}>
            <button className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 pt-2 pb-2 text-xs transition-colors min-h-[44px] justify-center ${
              pathname === href
                ? "text-primary font-medium"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
