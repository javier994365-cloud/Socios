import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Socios | Centro de Jubilados",
  description: "Administración del padrón de socios del centro de jubilados.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}