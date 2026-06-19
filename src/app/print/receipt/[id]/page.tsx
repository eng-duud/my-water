"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { numberToArabicWords } from "@/lib/num-to-words";

interface ReceiptData {
  id: string;
  amount: number;
  allocatedAmount: number;
  surplusAmount: number;
  surplusHandled: boolean;
  surplusNote: string | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  notes: string | null;
  createdAt: string;
  arrearsBefore: number;
  customer: {
    accountNumber: string;
    name: string;
    phone: string | null;
    village: string | null;
    meterNumber: string | null;
  };
  allocations: Array<{
    id: string;
    amount: number;
    bill: {
      billNumber: string;
      totalAmount: number;
      paidAmount: number;
      billingCycle: {
        year: number;
        month: number;
      };
    };
  }>;
}

const ARABIC_MONTHS = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const PAYMENT_METHODS: Record<string, string> = {
  CASH: "نقداً (كاش)",
  BANK: "تحويل بنكي / محفظة",
  CHECK: "شيك",
};

export default function ReceiptPrint() {
  const params = useParams();
  const id = params.id as string;
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchReceipt = async () => {
      try {
        const response = await fetch(`/api/payments/${id}`);
        if (!response.ok) throw new Error("فشل تحميل سند القبض");
        const data = await response.json();
        setReceipt(data);
      } catch (err) {
        console.error("Receipt fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [id]);

  useEffect(() => {
    if (receipt) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [receipt]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-slate-500 font-medium">
        جاري تجهيز سند القبض للطباعة...
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="flex justify-center items-center min-h-screen text-rose-500 font-bold">
        خطأ: سند القبض غير موجود أو تعذر جلبها.
      </div>
    );
  }

  const totalAllocated = receipt.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const remainingAfter = receipt.allocations.reduce((sum, a) => {
    const unpaid = Number(a.bill.totalAmount) - Number(a.bill.paidAmount);
    return sum + Math.max(unpaid, 0);
  }, 0);
  const totalWords = numberToArabicWords(Math.round(receipt.amount));
  const formatNum = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="print-container bg-white p-4 max-w-[21cm] mx-auto text-black font-sans dir-rtl space-y-3">
      {/* HEADER: Logo centered with text on both sides */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 gap-4">
        {/* Right Section: Entity Info */}
        <div className="text-right flex-1">
          <h1 className="text-base font-extrabold text-gray-900">الجمهورية اليمنية - محافظة تعز</h1>
          <h2 className="text-sm font-bold text-gray-800">مشروع مياه غيل الضياء قدس المواسط</h2>
          <p className="text-[10px] text-gray-600 font-bold mt-1">سند قبض رسمي</p>
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

        {/* Left Section: Receipt Number and Type */}
        <div className="text-left flex-1 flex flex-col items-end">
          <div className="border-2 border-black px-3 py-1 rounded bg-gray-50 mb-1">
            <p className="font-black text-sm">رقم السند: {receipt.receiptNumber || receipt.id.slice(0, 8)}</p>
          </div>
          <div className="bg-emerald-100 border-2 border-emerald-800 px-4 py-1 rounded shadow-sm">
            <h2 className="text-xs font-black text-emerald-900">سند قبض</h2>
          </div>
        </div>
      </div>

      {/* CUSTOMER INFO BAR */}
      <div className="bg-gradient-to-r from-gray-50 to-white border border-black rounded-sm p-2">
        <p className="text-xs">
          <span className="text-gray-600">المشترك: </span>
          <span className="font-bold text-sm">{receipt.customer.name}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">رقم المشترك: </span>
          <span className="font-bold font-mono">{receipt.customer.accountNumber}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">الهاتف: </span>
          <span className="font-bold font-mono">{receipt.customer.phone || "—"}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">القرية: </span>
          <span className="font-bold">{receipt.customer.village || "—"}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">رقم العداد: </span>
          <span className="font-bold font-mono">{receipt.customer.meterNumber || "—"}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">طريقة الدفع: </span>
          <span className="font-bold">{PAYMENT_METHODS[receipt.paymentMethod || ''] || receipt.paymentMethod || '—'}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">التاريخ: </span>
          <span className="font-bold font-mono">{new Date(receipt.createdAt).toLocaleDateString("ar-YE")}</span>
        </p>
      </div>

      {/* BILLS TABLE - ALLOCATIONS */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-black text-center text-[11px]">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-50">
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-gray-700">رقم الفاتورة</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-gray-700">دورة الفوترة</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-gray-700">قيمة الفاتورة</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-emerald-700">المسدد</th>
              <th className="p-1.5 text-xs font-bold text-gray-700">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {receipt.allocations.map((alloc) => {
              const billTotal = Number(alloc.bill.totalAmount);
              const billPaid = Number(alloc.bill.paidAmount);
              const remaining = Math.max(billTotal - billPaid, 0);
              return (
                <tr key={alloc.id} className="bg-white hover:bg-gray-50/50">
                  <td className="border-l-2 border-black p-2 font-mono font-bold text-slate-800">{alloc.bill.billNumber}</td>
                  <td className="border-l-2 border-black p-2 font-mono font-bold text-slate-700">
                    {alloc.bill.billingCycle.year}/{String(alloc.bill.billingCycle.month).padStart(2, '0')}
                  </td>
                  <td className="border-l-2 border-black p-2 font-mono font-bold text-slate-800">{formatNum(billTotal)}</td>
                  <td className="border-l-2 border-black p-2 font-mono font-bold text-emerald-700">{formatNum(Number(alloc.amount))}</td>
                  <td className="p-2 font-mono font-bold text-amber-700">{formatNum(remaining)}</td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="bg-gray-100 font-extrabold">
              <td colSpan={3} className="border-l-2 border-black p-2 text-xs font-bold text-gray-700">الإجمالي المدفوع</td>
              <td className="border-l-2 border-black p-2 font-mono font-extrabold text-lg text-emerald-800">{formatNum(receipt.amount)}</td>
              <td className="p-2 font-mono font-bold text-gray-700">{formatNum(remainingAfter)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SURPLUS */}
      {receipt.surplusAmount > 0 && (
        <div className="text-xs border-2 border-amber-300 p-2 bg-amber-50 rounded-sm">
          <p>
            <span className="font-bold text-amber-800">الرصيد الزائد: </span>
            <span className="font-mono font-extrabold text-amber-700">{formatNum(receipt.surplusAmount)} ريال</span>
            {receipt.surplusHandled && receipt.surplusNote && (
              <span className="text-gray-600"> — {receipt.surplusNote}</span>
            )}
            {!receipt.surplusHandled && (
              <span className="text-rose-600 font-semibold"> (معلق pending)</span>
            )}
          </p>
        </div>
      )}

      {/* AMOUNT IN WORDS */}
      <div className="text-right text-xs font-bold border-2 border-black p-2 bg-gradient-to-r from-emerald-50 to-white rounded-sm">
        <span>المبلغ المستلم كتابةً: </span>
        <span className="border-b-2 border-dotted border-black px-2 text-emerald-700 font-extrabold text-sm">{totalWords} ريال يمني</span>
        <span> لا غير</span>
      </div>

      {/* NOTES */}
      {receipt.notes && (
        <div className="text-[10px] border-2 border-black p-2 bg-gray-50 rounded-sm">
          <p className="font-bold mb-0.5">ملاحظات:</p>
          <p>{receipt.notes}</p>
        </div>
      )}

      {/* CONDITIONS */}
      <div className="text-[10px] space-y-1 text-slate-800 leading-relaxed border-2 border-black p-2.5 bg-gradient-to-r from-gray-50 to-white rounded-sm">
        <p className="font-bold text-center border-b border-gray-300 pb-1 mb-1 text-xs">⚠️ الضوابط والإرشادات</p>
        <p>• هذا السند يُعتبر إثباتاً رسمياً لعملية السداد المذكورة أعلاه.</p>
        <p>• يجب الاحتفاظ بهذا السند كمرجع لأي استفسارات مستقبلية.</p>
        <p>• أي تعديل أو شطب في هذا السند يجعله لاغياً.</p>
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
          <p className="font-bold mb-1 text-gray-700">توقيع المحصل</p>
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
          🖨️ طباعة
        </button>
      </div>
    </div>
  );
}
