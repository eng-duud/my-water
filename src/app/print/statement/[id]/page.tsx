"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { generatePrintFilename } from "@/lib/print-filename";

interface Transaction {
  date: string;
  type: "bill" | "payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
}

interface StatementData {
  customer: {
    id: string;
    accountNumber: string;
    name: string;
    phone: string | null;
    village: string | null;
    meterNumber: string | null;
    workUnits: number;
    totalConsumed: number;
  };
  transactions: Transaction[];
  summary: {
    totalBilled: number;
    totalPaid: number;
    currentBalance: number;
    billsCount: number;
    paymentsCount: number;
  };
}

export default function StatementPrint() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchStatement = async () => {
      try {
        const response = await fetch(`/api/customers/${id}/statement`);
        if (!response.ok) throw new Error("فشل تحميل كشف الحساب");
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Statement fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStatement();
  }, [id]);

  useEffect(() => {
    if (data) {
      document.title = generatePrintFilename('كشف حساب', data.customer.name);
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-slate-500 font-medium">
        جاري تجهيز كشف الحساب للطباعة...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-screen text-rose-500 font-bold">
        خطأ: كشف الحساب غير موجود أو تعذر جلبه.
      </div>
    );
  }

  const { customer, transactions, summary } = data;
  const formatNum = (n: number) => n.toLocaleString("en-US");
  const formatDate = (d: string) => new Date(d).toLocaleDateString("ar-YE");

  return (
    <div className="print-container bg-white p-4 max-w-[21cm] mx-auto text-black font-sans dir-rtl space-y-4">
      {/* HEADER: Logo centered with text on both sides */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 gap-4">
        {/* Right Section: Entity Info */}
        <div className="text-right flex-1">
          <h1 className="text-base font-extrabold text-gray-900">الجمهورية اليمنية - محافظة تعز</h1>
          <h2 className="text-sm font-bold text-gray-800">مشروع مياه غيل الضياء قدس المواسط</h2>
          <p className="text-[10px] text-gray-600 font-bold mt-1">كشف حساب مشترك</p>
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
            <h2 className="text-xs font-black text-sky-900">كشف حساب</h2>
          </div>
          <p className="text-[10px] text-gray-700 font-bold mt-1">
            تاريخ الإصدار: {new Date().toLocaleDateString("ar-YE")}
          </p>
        </div>
      </div>

      {/* CUSTOMER INFO */}
      <div className="bg-gradient-to-r from-gray-50 to-white border border-black rounded-sm p-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-600">اسم المشترك: </span>
            <span className="font-bold text-sm">{customer.name}</span>
          </div>
          <div>
            <span className="text-gray-600">رقم الحساب: </span>
            <span className="font-bold font-mono">{customer.accountNumber}</span>
          </div>
          <div>
            <span className="text-gray-600">الهاتف: </span>
            <span className="font-bold font-mono">{customer.phone || "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">القرية: </span>
            <span className="font-bold">{customer.village || "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">رقم العداد: </span>
            <span className="font-bold font-mono">{customer.meterNumber || "—"}</span>
          </div>
          <div>
            <span className="text-gray-600">الوحدات المستهلكة: </span>
            <span className="font-bold">{formatNum(customer.totalConsumed)}</span>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border-2 border-black rounded-sm p-2 text-center bg-rose-50">
          <p className="text-[10px] text-gray-600">إجمالي الفواتير</p>
          <p className="font-mono font-extrabold text-rose-700 text-sm">{formatNum(summary.totalBilled)} ريال</p>
          <p className="text-[9px] text-gray-500">({summary.billsCount} فاتورة)</p>
        </div>
        <div className="border-2 border-black rounded-sm p-2 text-center bg-emerald-50">
          <p className="text-[10px] text-gray-600">إجمالي المدفوعات</p>
          <p className="font-mono font-extrabold text-emerald-700 text-sm">{formatNum(summary.totalPaid)} ريال</p>
          <p className="text-[9px] text-gray-500">({summary.paymentsCount} دفعة)</p>
        </div>
        <div className={`border-2 border-black rounded-sm p-2 text-center ${summary.currentBalance > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
          <p className="text-[10px] text-gray-600">الرصيد الحالي</p>
          <p className={`font-mono font-extrabold text-sm ${summary.currentBalance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {formatNum(Math.abs(summary.currentBalance))} ريال
          </p>
          <p className="text-[9px] text-gray-500">
            {summary.currentBalance > 0 ? '(مدين)' : summary.currentBalance < 0 ? '(دائن)' : '(مسدد بالكامل)'}
          </p>
        </div>
      </div>

      {/* TRANSACTIONS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-black text-center text-[11px]">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-50">
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">#</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">التاريخ</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">البيان</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-700">المرجع</th>
              <th className="border border-black p-1.5 text-xs font-bold text-rose-700">مدين (فواتير)</th>
              <th className="border border-black p-1.5 text-xs font-bold text-emerald-700">دائن (مدفوعات)</th>
              <th className="border border-black p-1.5 text-xs font-bold text-gray-800">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, index) => (
              <tr key={index} className={tx.type === 'bill' ? 'bg-rose-50/30' : 'bg-emerald-50/30'}>
                <td className="border border-black p-1.5 font-mono text-gray-600">{index + 1}</td>
                <td className="border border-black p-1.5 font-mono">{formatDate(tx.date)}</td>
                <td className="border border-black p-1.5 font-bold text-right">{tx.description}</td>
                <td className="border border-black p-1.5 font-mono text-gray-700">{tx.reference}</td>
                <td className="border border-black p-1.5 font-mono font-bold text-rose-700">
                  {tx.debit > 0 ? formatNum(tx.debit) : '—'}
                </td>
                <td className="border border-black p-1.5 font-mono font-bold text-emerald-700">
                  {tx.credit > 0 ? formatNum(tx.credit) : '—'}
                </td>
                <td className={`border border-black p-1.5 font-mono font-bold ${tx.balance > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {formatNum(Math.abs(tx.balance))} {tx.balance > 0 ? '(م)' : tx.balance < 0 ? '(د)' : ''}
                </td>
              </tr>
            ))}
            {/* TOTALS ROW */}
            <tr className="bg-gray-100 font-extrabold">
              <td colSpan={4} className="border border-black p-2 text-xs font-bold text-gray-700 text-right">الإجمالي</td>
              <td className="border border-black p-2 font-mono font-extrabold text-rose-800">{formatNum(summary.totalBilled)}</td>
              <td className="border border-black p-2 font-mono font-extrabold text-emerald-800">{formatNum(summary.totalPaid)}</td>
              <td className={`border border-black p-2 font-mono font-extrabold ${summary.currentBalance > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                {formatNum(Math.abs(summary.currentBalance))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* NOTES */}
      <div className="text-[10px] space-y-1 text-slate-800 leading-relaxed border-2 border-black p-2.5 bg-gradient-to-r from-gray-50 to-white rounded-sm">
        <p className="font-bold text-center border-b border-gray-300 pb-1 mb-1 text-xs">ملاحظات</p>
        <p>• هذا الكشف يعكس جميع العمليات المالية المسجلة على حساب المشترك حتى تاريخ الإصدار.</p>
        <p>• (م) = مدين (مستحق على المشترك) | (د) = دائن (رصيد لصالح المشترك)</p>
        <p>• للاستفسار يرجى التواصل مع إدارة المشروع.</p>
      </div>

      {/* FOOTER */}
      <div className="flex justify-between items-center text-[9px] text-gray-500 pt-2 border-t-2 border-black">
        <span>تاريخ الطباعة: {new Date().toLocaleDateString("ar-YE")} {new Date().toLocaleTimeString("ar-YE", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {/* SIGNATURES */}
      <div className="flex justify-between items-center text-xs pt-2">
        <div className="text-center">
          <p className="font-bold mb-1 text-gray-700">الختم</p>
          <div className="w-20 h-8 border-2 border-dashed border-gray-400 mx-auto rounded"></div>
        </div>
        <div className="text-center">
          <p className="font-bold mb-1 text-gray-700">توقيع المسؤول</p>
          <div className="w-28 h-8 border-2 border-dashed border-gray-400 mx-auto rounded"></div>
        </div>
        <div className="text-center">
          <p className="font-bold mb-1 text-gray-700">توقيع المشترك</p>
          <div className="w-28 h-8 border-2 border-dashed border-gray-400 mx-auto rounded"></div>
        </div>
      </div>

      <div className="text-center pt-2 no-print">
        <button
          onClick={() => window.print()}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow"
        >
          طباعة كشف الحساب
        </button>
      </div>
    </div>
  );
}
