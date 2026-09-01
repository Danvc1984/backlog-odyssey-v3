"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, FolderOpen, Heart, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/today", label: "Today", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/collections", label: "Collections", icon: FolderOpen },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppNavProps {
  email?: string | null;
  signOutAction: () => Promise<void>;
}

export function AppNav({ email, signOutAction }: AppNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-8 border-r border-border bg-sidebar px-4 py-6 md:flex">
        <Link href="/today" className="flex items-center gap-3 px-2">
          <span className="grid size-[34px] place-items-center rounded-[11px] border border-signal font-technical text-[12px] font-bold text-signal-strong shadow-glow">
            BO
          </span>
          <span className="block text-base font-bold tracking-[-0.03em] text-sidebar-foreground">
            Backlog Odyssey
          </span>
        </Link>

        <nav className="flex flex-col gap-2">
          <p className="technical-label px-2 text-faint">Navigate</p>
          <ul className="grid gap-2">
            {navItems.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent px-3 py-[11px] text-[13px] transition-colors",
                    isActive(href)
                      ? "border-signal/25 bg-signal/10 font-medium text-signal-strong"
                      : "text-muted-foreground hover:border-signal/25 hover:bg-signal/10 hover:text-signal-strong",
                  )}
                >
                  <Icon className="size-[18px]" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto border-t border-border px-2 pt-4">
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <form action={signOutAction}>
            <button className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-signal/10 hover:text-signal-strong">
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 gap-1 rounded-2xl border border-border-strong bg-sidebar/95 p-2 shadow-card backdrop-blur-md md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl font-technical text-[9px] uppercase tracking-wider transition-colors",
              isActive(href)
                ? "bg-signal/10 text-signal-strong"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}