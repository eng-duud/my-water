"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-4xl font-black text-slate-800 mb-4">خطأ</h1>
      <p className="text-lg text-slate-500 mb-6">حدث خطأ غير متوقع</p>
      <button
        onClick={() => reset()}
        className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
