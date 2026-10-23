"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Native <dialog> (focus trap and Escape for free). `variant="side"` docks it
 * to the right on desktop and fills the screen on phones.
 */
export function Dialog({
  open,
  onClose,
  title,
  variant = "center",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "center" | "side";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const placement =
    variant === "side"
      ? "m-0 ml-auto h-dvh max-h-dvh w-full max-w-full sm:max-w-md sm:border-l"
      : "m-auto w-[calc(100%-2rem)] max-w-md rounded-dialog border";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      className={`border-line bg-panel p-0 text-ink shadow-float backdrop:bg-overlay ${placement}`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id="dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-calm hover:text-ink"
              aria-label="Cerrar"
            >
              <X aria-hidden size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
