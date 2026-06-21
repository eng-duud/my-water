"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { generatePrintFilename } from "@/lib/print-filename";

interface CustomerSummary {
  id: string;
  accountNumber: string;
  name: string;
  phone: string | null;
  village: string | null;
  meterNumber: string | null;
  isActive: boolean;
  totalBilled: number;
  totalPaid: number;
  currentBalance: number;
}

interface VillageStatementData {
  village: string;
  customers: CustomerSummary[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    currentBalance: number;
    customersCount: number;
  };
}

function VillageStatementContent() {
  const searchParams = useSearchParams();
  const village = searchParams.get("village");
  const [data, setData] = useState<VillageStatementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!village) return;
    const fetchStatement = async () => {
      try {
        const response = await fetch(`/api/customers/village-statement?village=${encodeURIComponent(village)}`);
        if (!response.ok) throw new Error("فشل تحميل كشف الحساب");
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Village statement fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatement();
  }, [village]);

  useEffect(() => {
    if (data) {
      document.title = generatePrintFilename('كشف موحد', data.village);
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (!village) {
    return (
      <div className="flex justify-center items-center min-h-screen text-rose-500 font-bold">
        خطأ: لم يتم تحديد القرية.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-slate-500 font-medium">
        جاري تجهيز كشف الحساب الموحد للطباعة...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-screen text-rose-500 font-bold">
        خطأ: كشف الحساب الموحد غير موجود أو تعذر جلبه.
      </div>
    );
  }

  const { customers, summary } = data;
  const formatNum = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");

  return (
    <div className="print-container bg-white p-4 max-w-[21cm] mx-auto text-black font-sans dir-rtl space-y-4">
      {/* HEADER: Logo centered with text on both sides */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 gap-4">
        {/* Right Section: Entity Info */}
        <div className="text-right flex-1">
          <h1 className="text-base font-extrabold text-gray-900">الجمهورية اليمنية - محافظة تعز</h1>
          <h2 className="text-sm font-bold text-gray-800">مشروع مياه غيل الضياء قدس المواسط</h2>
          <p className="text-[10px] text-gray-600 font-bold mt-1">كشف حساب موحد للقرية</p>
        </div>

        {/* Center: Logo */}
        <div className="shrink-0">
          <img
            src="/logo.png"
            alt="شعار المشروع"
            className="w-24 h-24 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Left Section: Statement Type */}
        <div className="text-left flex-1 flex flex-col items-end">
          <div className="bg-sky-100 border-2 border-sky-800 px-4 py-1 rounded shadow-sm">
            <h2 className="text-xs font-black text-sky-900">كشف حساب موحد</h2>
          </div>
          <p className="text-[10px] text-gray-700 font-bold mt-1">
            تاريخ الإصدار: {new Date().toLocaleDateString("ar-YE")}
          </p>
        </div>
      </div>

      {/* VILLAGE INFO */}
      <div className="bg-gradient-to-r from-gray-50 to-white border border-black rounded-sm p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-600">القرية: </span>
            <span className="font-bold text-sm">{data.village}</span>
          </div>
          <div>
            <span className="text-gray-600">عدد المشتركين: </span>
            <span className="font-bold">{summary.customersCount} مشترك</span>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border-2 border-black rounded-sm p-2 text-center bg-rose-50">
          <p className="text-[10px] text-gray-600">إجمالي فواتير القرية</p>
          <p className="font-mono font-extrabold text-rose-700 text-sm">{formatNum(summary.totalBilled)} ريال</p>
        </div>
        <div className="border-2 border-black rounded-sm p-2 text-center bg-emerald-50">
          <p className="text-[10px] text-gray-600">إجمالي مدفوعات القرية</p>
          <p className="font-mono font-extrabold text-emerald-700 text-sm">{formatNum(summary.totalPaid)} ريال</p>
        </div>
        <div className={`border-2 border-black rounded-sm p-2 text-center ${summary.currentBalance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
          <p className="text-[10px] text-gray-600">الرصيد الكلي المتبقي</p>
          <p className={`font-mono font-extrabold text-sm ${summary.currentBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {formatNum(Math.abs(summary.currentBalance))} ريال
          </p>
          <p className="text-[9px] text-gray-500">
            {summary.currentBalance > 0 ? '(مستحق للمشروع)' : summary.currentBalance < 0 ? '(فائض)' : '(مسدد بالكامل)'}
          </p>
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-black text-center text-[11px]">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-50">
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">#</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">رقم الحساب</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">اسم المشترك</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">الهاتف</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">رقم العداد</th>
              <th className="border border-black p-1.5 text-xs font-bold text-rose-700">إجمالي الفواتير</th>
              <th className="border border-black p-1.5 text-xs font-bold text-emerald-700">إجمالي المدفوعات</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-800">الرصيد الحالي</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, index) => (
              <tr key={c.id} className={!c.isActive ? 'bg-slate-100/50' : ''}>
                <td className="border border-black p-1.5 font-mono text-gray-600">{index + 1}</td>
                <td className="border border-black p-1.5 font-mono font-bold">{c.accountNumber}</td>
                <td className="border border-black p-1.5 font-bold text-right px-2">{c.name}</td>
                <td className="border border-black p-1.5 font-mono">{c.phone || "—"}</td>
                <td className="border border-black p-1.5 font-mono">{c.meterNumber || "—"}</td>
                <td className="border border-black p-1.5 font-mono font-bold text-rose-700">
                  {c.totalBilled > 0 ? formatNum(c.totalBilled) : '—'}
                </td>
                <td className="border border-black p-1.5 font-mono font-bold text-emerald-700">
                  {c.totalPaid > 0 ? formatNum(c.totalPaid) : '—'}
                </td>
                <td className={`border border-black p-1.5 font-mono font-bold ${c.currentBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {formatNum(Math.abs(c.currentBalance))} {c.currentBalance > 0 ? '(م)' : c.currentBalance < 0 ? '(د)' : ''}
                </td>
                <td className="border border-black p-1.5">
                  <span className={`text-[10px] font-bold ${c.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {c.isActive ? 'نشط' : 'موقف'}
                  </span>
                </td>
              </tr>
            ))}
            {/* TOTALS ROW */}
            <tr className="bg-gray-100 font-extrabold">
              <td colSpan={5} className="border border-black p-2 text-xs font-bold text-gray-700 text-right">الإجمالي الكلي</td>
              <td className="border border-black p-2 font-mono font-extrabold text-rose-800">{formatNum(summary.totalBilled)}</td>
              <td className="border border-black p-2 font-mono font-extrabold text-emerald-800">{formatNum(summary.totalPaid)}</td>
              <td className={`border border-black p-2 font-mono font-extrabold ${summary.currentBalance > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                {formatNum(Math.abs(summary.currentBalance))} {summary.currentBalance > 0 ? '(مستحق)' : summary.currentBalance < 0 ? '(فائض)' : ''}
              </td>
              <td className="border border-black p-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* NOTES */}
      <div className="text-[10px] space-y-1 text-slate-800 leading-relaxed border-2 border-black p-2.5 bg-gradient-to-r from-gray-50 to-white rounded-sm">
        <p className="font-bold text-center border-b border-gray-300 pb-1 mb-1 text-xs">ملاحظات الكشف الموحد</p>
        <p>• يعكس هذا الكشف الوضع المالي العام لجميع المشتركين المسجلين في قرية ({data.village}) حتى تاريخ الطباعة.</p>
        <p>• (م) تعني مدين (مستحق على المشترك لصالح المشروع) | (د) تعني دائن (رصيد للمشترك).</p>
      </div>

      {/* FOOTER */}
      <div className="flex justify-between items-center text-[9px] text-gray-500 pt-2 border-t-2 border-black">
        <span>تاريخ الطباعة: {new Date().toLocaleDateString("ar-YE")} {new Date().toLocaleTimeString("ar-YE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {/* SIGNATURES */}
      <div className="flex justify-between items-center text-xs pt-2">
        <div className="text-center">
          <p className="font-bold mb-1 text-gray-700">الختم الرسمي</p>
          <div className="w-20 h-8 border-2 border-dashed border-gray-400 mx-auto rounded"></div>
        </div>
        <div className="text-center">
          <p className="font-bold mb-1 text-gray-700">المحاسب المسؤول</p>
          <div className="w-28 h-8 border-2 border-dashed border-gray-400 mx-auto rounded"></div>
        </div>
        <div className="text-center">
          <p className="font-bold mb-1 text-gray-700">إدارة المشروع</p>
          <div className="w-28 h-8 border-2 border-dashed border-gray-400 mx-auto rounded"></div>
        </div>
      </div>

      <div className="text-center pt-2 no-print">
        <button
          onClick={() => window.print()}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow"
        >
          طباعة الكشف
        </button>
      </div>
    </div>
  );
}

export default function VillageStatementPrint() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen text-slate-500 font-medium animate-pulse">جاري التحميل...</div>}>
      <VillageStatementContent />
    </Suspense>
  );
}
