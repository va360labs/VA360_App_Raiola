import { adminPassword } from "@/lib/config";
import { safeNextPath } from "@/lib/auth/access";
import { clinicDisplayName } from "@/lib/settings";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const configured = adminPassword() !== null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-panel border border-line bg-panel p-6 sm:p-8">
        <p className="text-sm text-ink-muted">{clinicDisplayName()}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Entrar al panel</h1>
        {configured ? (
          <LoginForm next={safeNextPath(next)} />
        ) : (
          <div role="alert" className="mt-6 rounded-control bg-review-subtle p-4 text-sm text-review">
            Falta la clave de administración. Añade <span className="font-mono">ADMIN_PASSWORD</span> a la
            configuración del servidor y vuelve a arrancar la aplicación.
          </div>
        )}
      </div>
    </main>
  );
}
