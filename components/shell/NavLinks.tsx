"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Inbox, MessagesSquare, Settings } from "lucide-react";

const ITEMS = [
  { href: "/bandeja", label: "Bandeja", Icon: Inbox },
  { href: "/documentos", label: "Documentos", Icon: FileText },
  { href: "/simulador", label: "Simulador", Icon: MessagesSquare },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical navigation for tablet and desktop. */
export function SideNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-control px-3 text-sm font-medium ${
                active ? "bg-action-subtle text-action-active" : "text-ink-muted hover:bg-calm hover:text-ink"
              }`}
            >
              <Icon aria-hidden size={18} strokeWidth={1.5} />
              <span className="flex-1 md:max-lg:sr-only">{label}</span>
              {href === "/bandeja" && reviewCount > 0 && (
                <span
                  className="tabular rounded-full bg-review-subtle px-2 py-0.5 text-xs font-semibold text-review md:max-lg:sr-only"
                  aria-label={`${reviewCount} por revisar`}
                >
                  {reviewCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Bottom tab bar for phones. */
export function BottomNav({ reviewCount }: { reviewCount: number }) {
  const pathname = usePathname();
  return (
    <ul className="grid grid-cols-4">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                active ? "text-action-active" : "text-ink-muted"
              }`}
            >
              <Icon aria-hidden size={20} strokeWidth={1.5} />
              {label}
              {href === "/bandeja" && reviewCount > 0 && (
                <span
                  className="tabular absolute top-1.5 left-1/2 ml-2 rounded-full bg-review-subtle px-1.5 text-[11px] font-semibold text-review"
                  aria-label={`${reviewCount} por revisar`}
                >
                  {reviewCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
