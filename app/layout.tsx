import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-atkinson",
  display: "swap",
  adjustFontFallback: false,
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-atkinson-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Respuestas de la clínica",
  description: "Respuestas a pacientes preparadas con los documentos de la clínica.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
