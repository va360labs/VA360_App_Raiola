import { LogOut } from "lucide-react";
import { clinicDisplayName, countNeedsReview } from "@/lib/settings";
import { BottomNav, SideNav } from "./NavLinks";

/** Panel frame: sidebar on tablet/desktop, bottom tabs on phones. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const reviewCount = countNeedsReview();
  const clinicName = clinicDisplayName();

  return (
    <div className="min-h-dvh bg-canvas md:flex">
      <aside className="hidden shrink-0 flex-col border-r border-line bg-panel md:flex md:w-[72px] lg:w-[232px]">
        <div className="flex h-16 items-center px-4 md:max-lg:justify-center">
          <span className="truncate text-sm font-semibold text-ink md:max-lg:sr-only">{clinicName}</span>
          <span aria-hidden className="hidden h-8 w-8 items-center justify-center rounded-control bg-action-subtle text-sm font-semibold text-action-active md:max-lg:flex">
            {clinicName.charAt(0)}
          </span>
        </div>
        <nav aria-label="Principal" className="flex-1 px-3">
          <SideNav reviewCount={reviewCount} />
        </nav>
        <form action="/api/auth/logout" method="post" className="border-t border-line p-3">
          <button
            type="submit"
            className="flex h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-ink-muted hover:bg-calm hover:text-ink md:max-lg:justify-center"
          >
            <LogOut aria-hidden size={18} strokeWidth={1.5} />
            <span className="md:max-lg:sr-only">Cerrar sesión</span>
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="flex h-14 items-center justify-between border-b border-line bg-panel px-4 md:hidden">
          <span className="truncate text-sm font-semibold text-ink">{clinicName}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="flex h-11 items-center gap-2 px-2 text-sm text-ink-muted" aria-label="Cerrar sesión">
              <LogOut aria-hidden size={18} strokeWidth={1.5} />
            </button>
          </form>
        </header>
        <main className="flex-1">{children}</main>
      </div>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 border-t border-line bg-panel md:hidden">
        <BottomNav reviewCount={reviewCount} />
      </nav>
    </div>
  );
}
