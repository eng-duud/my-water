"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "كلمة المرور غير صحيحة");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="شعار المشروع"
              className="w-28 h-28 object-contain rounded-2xl bg-white/10 p-2 backdrop-blur"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white">مشروع مياه غيل الضياء</h1>
          <p className="text-sky-200 text-sm mt-1">نظام إدارة الفوترة والتحصيل</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">تسجيل الدخول</h2>
            <p className="text-sky-200 text-xs mt-1">يرجى إدخال كلمة المرور للوصول إلى النظام</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 text-red-200 text-sm p-3 rounded-xl text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-sky-200 mb-2">كلمة المرور</label>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل كلمة المرور"
              className="w-full bg-white/5 border border-white/20 text-white placeholder-slate-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/25"
          >
            {loading ? "جاري تسجيل الدخول..." : "دخول"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          نظام الفوترة © 2026
        </p>
      </div>
    </div>
  );
}
