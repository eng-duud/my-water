import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "غيل الضياء - نظام إدارة فواتير المياه",
  description: "نظام تحصيل وإدارة فواتير المياه لمشروع غيل الضياء - قدس المواسط",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased bg-slate-50 text-slate-800">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
