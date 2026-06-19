"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/auth/login", { method: "DELETE" });
    window.location.href = "/login";
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Navigation Sidebar */}
      <aside className="no-print w-full md:w-64 glass-panel text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wide text-brand-100">غيل الضياء</h1>
          <p className="text-xs text-slate-400 mt-1">قدس المواسط لإدارة المياه</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/"
            className="flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 hover:text-white"
          >
            <span>📊</span>
            <span className="font-medium">لوحة التحكم</span>
          </Link>

          <Link
            href="/customers"
            className="flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 hover:text-white"
          >
            <span>👥</span>
            <span className="font-medium">إدارة المشتركين</span>
          </Link>

          <Link
            href="/billing"
            className="flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 hover:text-white"
          >
            <span>💧</span>
            <span className="font-medium">قراءة العدادات والفوترة</span>
          </Link>

          <Link
            href="/payments"
            className="flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg hover:bg-slate-800 transition-colors text-slate-200 hover:text-white"
          >
            <span>💵</span>
            <span className="font-medium">سداد الفواتير والتحصيل</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 space-x-reverse w-full px-4 py-2.5 rounded-lg hover:bg-red-800/40 transition-colors text-slate-400 hover:text-red-300 text-sm"
          >
            <span>🚪</span>
            <span className="font-medium">تسجيل خروج</span>
          </button>
        </div>

        <div className="px-4 pb-4 text-center text-xs text-slate-500 no-print">
          نظام الفوترة © 2026
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header Bar */}
        <header className="no-print bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="text-xl">🚰</span>
            <span className="font-semibold text-slate-800">مشروع مياه غيل الضياء</span>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200">
              متصل بقاعدة البيانات
            </span>
          </div>
        </header>

        {/* Children Pages */}
        <div className="flex-1 p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
