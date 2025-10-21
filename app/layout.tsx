import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kalium Network — Incidencias",
  description: "Sistema de gestión de incidencias para el servidor de Minecraft Kalium Network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
