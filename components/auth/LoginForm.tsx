"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lockedSeconds, setLockedSeconds] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (lockedSeconds <= 0) return;
    const timer = setTimeout(() => setLockedSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockedSeconds]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string; retryAfterSeconds?: number };
      if (response.status === 429) {
        setLockedSeconds(data.retryAfterSeconds ?? 60);
        setError("Demasiados intentos fallidos.");
      } else {
        setError(data.error ?? "No se pudo iniciar sesión.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setPending(false);
    }
  }

  const locked = lockedSeconds > 0;

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Clave de acceso
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          className="block h-11 w-full rounded-control border border-line-strong bg-panel px-3 text-base text-ink focus-visible:border-action"
        />
      </div>

      {error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {error}
          {locked && (
            <>
              {" "}
              Podrás volver a intentarlo en <span className="tabular">{lockedSeconds}</span> s.
            </>
          )}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending || locked || password.length === 0}>
        {pending ? "Comprobando…" : "Entrar al panel"}
      </Button>
    </form>
  );
}
