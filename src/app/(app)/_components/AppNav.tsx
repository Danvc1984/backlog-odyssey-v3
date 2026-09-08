"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HouseIcon, BooksIcon, FolderOpenIcon, HeartIcon, GearIcon, SignOutIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "backlog-odyssey:sidebar-collapsed";

const navItems = [
  { href: "/today", label: "Today", icon: HouseIcon },
  { href: "/library", label: "Library", icon: BooksIcon },
  { href: "/collections", label: "Collections", icon: FolderOpenIcon },
  { href: "/wishlist", label: "Wishlist", icon: HeartIcon },
  { href: "/settings", label: "Settings", icon: GearIcon },
];

interface AppNavProps {
  email?: string | null;
  signOutAction: () => Promise<void>;
}

export function AppNav({ email, signOutAction }: AppNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1");
      } catch {
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        if (next) window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "1");
        else window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      } catch {
      }
      return next;
    });
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <aside
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a, button")) return;
          toggleCollapsed();
        }}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-8 border-r border-border bg-sidebar px-4 py-6 md:flex",
          collapsed ? "w-[68px] items-center" : "w-[232px]",
        )}
      >
        <Link
          href="/today"
          aria-label="Backlog Odyssey"
          title={collapsed ? "Backlog Odyssey" : undefined}
          className={cn("flex items-center gap-3 px-2", collapsed && "justify-center")}
        >
          <span
            aria-hidden
            className="brand-dragon-mark size-[34px] shrink-0 rounded-[11px] border border-signal bg-signal-strong p-1"
          />
          <span className={cn(
            "block font-display text-base font-semibold tracking-[0.01em] text-sidebar-foreground",
            collapsed && "hidden",
          )}>
            Backlog Odyssey
          </span>
        </Link>

        <nav className="flex flex-col gap-2">
          <p className={cn("technical-label px-2 text-faint", collapsed && "sr-only")}>Navigate</p>
          <ul className="grid gap-2">
            {navItems.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive(href) ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent px-3 py-[11px] text-[13px] transition-colors",
                    collapsed && "justify-center px-3",
                    isActive(href)
                      ? "border-signal/25 bg-signal/10 font-medium text-signal-strong"
                      : "text-muted-foreground hover:border-signal/25 hover:bg-signal/10 hover:text-signal-strong",
                  )}
                >
                  <Icon className="size-[18px]" />
                  <span className={collapsed ? "hidden" : undefined}>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={cn("mt-auto border-t border-border px-2 pt-4", collapsed && "w-full")}>
          <p className={cn("truncate text-xs text-muted-foreground", collapsed && "hidden")}>{email}</p>
          <form action={signOutAction}>
            <button
              title={collapsed ? "Sign out" : undefined}
              aria-label={collapsed ? "Sign out" : undefined}
              className={cn(
                "mt-2 flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-signal/10 hover:text-signal-strong",
                collapsed && "justify-center px-2",
              )}
            >
              <SignOutIcon className="size-4" />
              <span className={collapsed ? "hidden" : undefined}>Sign out</span>
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
