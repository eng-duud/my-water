import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-6xl font-black text-slate-800 mb-4">404</h1>
      <p className="text-lg text-slate-500 mb-6">الصفحة غير موجودة</p>
      <Link
        href="/"
        className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
      >
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
