"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { numberToArabicWords } from "@/lib/num-to-words";

interface BillData {
  id: string;
  billNumber: string;
  previousReading: string;
  currentReading: string;
  consumption: string;
  workUnits: number;
  workUnitsTotal: string;
  tier1Units: string;
  tier1Cost: string;
  tier2Units: string;
  tier2Cost: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  createdAt: string;
  previousBillAmount?: number;
  previousBillPaid?: number;
  customer: {
    accountNumber: string;
    name: string;
    phone: string | null;
    address: string | null;
    meterNumber: string | null;
  };
  billingCycle: {
    year: number;
    month: number;
  };
}

const ARABIC_MONTHS = [
  "",
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export default function SingleBillPrint() {
  const params = useParams();
  const id = params.id as string;
  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchBill = async () => {
      try {
        const response = await fetch(`/api/billing/bill?id=${id}`);
        if (!response.ok) throw new Error("فشل تحميل الفاتورة");
        const data = await response.json();
        setBill(data);
      } catch (err) {
        console.error("Print fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [id]);

  useEffect(() => {
    if (bill) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [bill]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-slate-500 font-medium">
        جاري تجهيز الفاتورة للطباعة...
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex justify-center items-center min-h-screen text-rose-500 font-bold">
        خطأ: الفاتورة غير موجودة أو متعذرة جلبها.
      </div>
    );
  }

  const previousReading = Number(bill.previousReading);
  const currentReading = Number(bill.currentReading);
  const consumption = Number(bill.consumption);
  const workUnits = bill.workUnits;
  const consumptionCost = Number(bill.tier1Cost) + Number(bill.tier2Cost);
  const monthTotal = Number(bill.totalAmount);
  const previousBillAmount = Number(bill.previousBillAmount || 0);
  const previousBillPaid = Number(bill.previousBillPaid || 0);
  const grandTotal = monthTotal + previousBillAmount - previousBillPaid;

  const totalWords = numberToArabicWords(Math.round(grandTotal));

  return (
    <div className="print-container bg-white p-4 max-w-[21cm] mx-auto text-black font-sans dir-rtl space-y-4">
      {/* Header Info */}
      <div className="flex justify-between items-center border-b border-black pb-2">
        <div className="text-right">
          <h1 className="text-base font-bold">مشروع مياه غيل الضياء قدس المواسط</h1>
          <p className="text-xs text-gray-700">المطلوب من الأخ / <span className="font-bold border-b border-dotted border-black px-1 text-sm">{bill.customer.name}</span></p>
        </div>
        <div className="text-center bg-gray-100 border border-black px-4 py-1.5 rounded">
          <h2 className="text-sm font-extrabold tracking-wider">فاتورة المياه</h2>
        </div>
        <div className="text-left text-xs space-y-0.5">
          <p>رقم الفاتورة: <span className="font-bold font-mono border-b border-black">{bill.billNumber}</span></p>
          <p>المنطقة: <span className="font-semibold">{bill.customer.address || "—"}</span></p>
        </div>
      </div>

      {/* Meta Grid Row */}
      <div className="grid grid-cols-4 gap-2 text-xs border border-black p-2 bg-gray-50/50">
        <div className="flex justify-between border-l border-gray-300 pl-2">
          <span className="text-gray-600">رقم المشترك:</span>
          <span className="font-bold">{bill.customer.accountNumber}</span>
        </div>
        <div className="flex justify-between border-l border-gray-300 pl-2 px-2">
          <span className="text-gray-600">التاريخ:</span>
          <span className="font-bold">{new Date(bill.createdAt).toLocaleDateString('ar-YE')}</span>
        </div>
        <div className="flex justify-between border-l border-gray-300 pl-2 px-2">
          <span className="text-gray-600">رقم العداد:</span>
          <span className="font-bold">{bill.customer.meterNumber || "—"}</span>
        </div>
        <div className="flex justify-between px-2">
          <span className="text-gray-600">الشهر:</span>
          <span className="font-bold">{ARABIC_MONTHS[bill.billingCycle.month]} {bill.billingCycle.year}</span>
        </div>
      </div>

      {/* Main Consolidated Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-black text-center text-[10px]">
          <thead className="bg-gray-100">
            <tr className="border-b border-black">
              <th className="border-l border-black p-1" colSpan={2}>قراءة العداد</th>
              <th className="border-l border-black p-1" rowSpan={2}>وحدات فعلية</th>
              <th className="border-l border-black p-1" rowSpan={2}>وحدات تقديرية</th>
              <th className="border-l border-black p-1" rowSpan={2}>وحدات العمل</th>
              <th className="border-l border-black p-1" rowSpan={2}>قيمة الإستهلاك</th>
              <th className="border-l border-black p-1" rowSpan={2}>رسوم الخدمات</th>
              <th className="border-l border-black p-1" rowSpan={2}>الغرامات</th>
              <th className="border-l border-black p-1" rowSpan={2}>الإعفاءات</th>
              <th className="border-l border-black p-1" rowSpan={2}>إجمالي الشهر</th>
              <th className="border-l border-black p-1" colSpan={2}>الفاتورة السابقة</th>
              <th className="p-1" rowSpan={2}>إجمالي الفاتورة</th>
            </tr>
            <tr className="border-b border-black">
              <th className="border-l border-black p-0.5">الكلية (الحالية)</th>
              <th className="border-l border-black p-0.5">السابقة</th>
              <th className="border-l border-black p-0.5">القيمة</th>
              <th className="border-l border-black p-0.5">المسدد</th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-semibold text-slate-900">
              <td className="border-l border-black p-1.5 font-mono">{currentReading.toFixed(2)}</td>
              <td className="border-l border-black p-1.5 font-mono">{previousReading.toFixed(2)}</td>
              <td className="border-l border-black p-1.5 font-mono">{consumption.toFixed(2)}</td>
              <td className="border-l border-black p-1.5 font-mono">0.00</td>
              <td className="border-l border-black p-1.5 font-mono">{workUnits}</td>
              <td className="border-l border-black p-1.5 font-mono">{consumptionCost.toLocaleString()}</td>
              <td className="border-l border-black p-1.5 font-mono">0</td>
              <td className="border-l border-black p-1.5 font-mono">0</td>
              <td className="border-l border-black p-1.5 font-mono">0</td>
              <td className="border-l border-black p-1.5 font-mono">{monthTotal.toLocaleString()}</td>
              <td className="border-l border-black p-1.5 font-mono">{previousBillAmount.toLocaleString()}</td>
              <td className="border-l border-black p-1.5 font-mono">{previousBillPaid.toLocaleString()}</td>
              <td className="p-1.5 font-extrabold text-rose-700 bg-rose-50/50 font-mono">{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tafqeet block */}
      <div className="text-right text-xs font-bold border-b border-black pb-2">
        <span>عليكم فقط </span>
        <span className="border-b border-dotted border-black px-1 text-rose-700 text-sm">{totalWords} ريال يمني</span>
        <span> لا غير</span>
      </div>

      {/* Alert notes */}
      <div className="text-[10px] space-y-1 text-slate-800 leading-normal border border-black p-2 rounded bg-gray-50/50">
        <p className="font-semibold text-center border-b border-gray-300 pb-1 text-xs">⚠️ تعليمات وإرشادات هامة</p>
        <p>• بعد التحية، يرجى السداد في موعد أقصاه ست أيام من تاريخ استلام الفاتورة لتفادي انقطاع الخدمات.</p>
        <p className="font-bold text-rose-700">• يمنع سقي القات ومن يخالف يدفع غرامة مالية قدرها عشرون ألف ريال ويفصل العداد.</p>
      </div>

      {/* Price Footer */}
      <div className="flex justify-between items-center text-[9px] text-gray-500 pt-2 border-t border-black">
        <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-YE')} {new Date().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="font-mono">سعر الشريحة: من 0 إلى 4 = 700 ريال/م٣ | من 5 وما فوق = 1,000 ريال/م٣ | وحدة العمل = 2,000 ريال</span>
      </div>

      {/* Print Page Control */}
      <div className="text-center pt-4 no-print">
        <button
          onClick={() => window.print()}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors border border-black shadow"
        >
          🖨️ إعادة المحاولة للطباعة
        </button>
      </div>
    </div>
  );
}
