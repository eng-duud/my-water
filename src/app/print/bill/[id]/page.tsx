"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { numberToArabicWords } from "@/lib/num-to-words";
import { generatePrintFilename } from "@/lib/print-filename";

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
  serviceFee: string;
  fine: string;
  exemption: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  createdAt: string;
  arrears?: number;
  customer: {
    accountNumber: string;
    name: string;
    phone: string | null;
    village: string | null;
    meterNumber: string | null;
  };
  billingCycle: {
    year: number;
    month: number;
  };
}

const ARABIC_MONTHS = [
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
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
      document.title = generatePrintFilename('فاتورة', bill.customer.name);
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
        خطأ: الفاتورة غير موجودة أو تعذر جلبها.
      </div>
    );
  }

  const previousReading = Number(bill.previousReading);
  const currentReading = Number(bill.currentReading);
  const actualConsumption = Math.max(currentReading - previousReading, 0);
  const storedConsumption = Number(bill.consumption);
  const isEstimated = storedConsumption !== actualConsumption && storedConsumption > 0;
  const usedConsumption = isEstimated ? storedConsumption : actualConsumption;

  const tier1Cost = Number(bill.tier1Cost);
  const tier2Cost = Number(bill.tier2Cost);
  const rawConsumptionCost = tier1Cost + tier2Cost;
  const MINIMUM_FEE = 1000;
  const consumptionCost = Math.max(rawConsumptionCost, MINIMUM_FEE);

  const serviceFee = Number(bill.serviceFee);
  const fine = Number(bill.fine);
  const exemption = Number(bill.exemption);
  const monthTotal = Number(bill.totalAmount);
  const arrears = Number(bill.arrears || 0);
  const grandTotal = monthTotal + arrears;

  const totalWords = numberToArabicWords(Math.round(grandTotal));

  const formatNum = (n: number) => n.toLocaleString("en-US");
  const readingFormat = (n: number) => n.toFixed(2);

  return (
    <div className="print-container bg-white p-4 max-w-[21cm] mx-auto text-black font-sans dir-rtl space-y-3">
      {/* HEADER: Logo centered with text on both sides */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3 gap-4">
        {/* Right Section: Entity Info */}
        <div className="text-right flex-1">
          <h1 className="text-base font-extrabold text-gray-900">الجمهورية اليمنية - محافظة تعز</h1>
          <h2 className="text-sm font-bold text-gray-800">مشروع مياه غيل الضياء قدس المواسط</h2>
          <p className="text-[10px] text-gray-600 font-bold mt-1">فاتورة استهلاك مياه الشرب</p>
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

        {/* Left Section: Bill Number and Type */}
        <div className="text-left flex-1 flex flex-col items-end">
          <div className="border-2 border-black px-3 py-1 rounded bg-gray-50 mb-1">
            <p className="font-black text-sm">رقم الفاتورة: {bill.billNumber}</p>
          </div>
          <div className="bg-amber-100 border-2 border-amber-800 px-4 py-1 rounded shadow-sm">
            <h2 className="text-xs font-black text-amber-900">فاتورة المياه</h2>
          </div>
        </div>
      </div>

      {/* CUSTOMER INFO BAR */}
      <div className="bg-gradient-to-r from-gray-50 to-white border border-black rounded-sm p-2">
        <p className="text-xs">
          <span className="text-gray-600">المطلوب من الأخ / </span>
          <span className="font-bold border-b border-dotted border-black text-sm">{bill.customer.name}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">رقم المشترك: </span>
          <span className="font-bold font-mono">{bill.customer.accountNumber}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">الهاتف: </span>
          <span className="font-bold font-mono">{bill.customer.phone || "—"}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">القرية: </span>
          <span className="font-bold">{bill.customer.village || "—"}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">رقم العداد: </span>
          <span className="font-bold font-mono">{bill.customer.meterNumber || "—"}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">شهر: </span>
          <span className="font-bold">{ARABIC_MONTHS[bill.billingCycle.month]} {bill.billingCycle.year}</span>
          <span className="text-gray-600 mx-2">|</span>
          <span className="text-gray-600">التاريخ: </span>
          <span className="font-bold font-mono">{new Date(bill.createdAt).toLocaleDateString("ar-YE")}</span>
        </p>
      </div>

      {/* MAIN TABLE - COLUMNS SIDE BY SIDE */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-2 border-black text-center text-[11px]">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-50">
              <th colSpan={2} className="border-l-2 border-black p-1.5 text-xs font-bold text-gray-700">قراءة العداد</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-blue-800">الاستهلاك الفعلي</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-amber-700">التقديري</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-purple-800">وحدات العمل</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-emerald-800">قيمة الاستهلاك</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-sky-800">رسوم الخدمات</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-rose-700">الغرامات</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-emerald-600">الإعفاءات</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-gray-800">إجمالي الشهر</th>
              <th className="border-l-2 border-black p-1.5 text-xs font-bold text-rose-800">المتأخرات</th>
              <th className="p-1.5 text-xs font-extrabold text-red-900 bg-red-50">الإجمالي الكلي</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">الحالية</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">السابقة</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">م³</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">م³</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">وحدة</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">ريال</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">ريال</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">ريال</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">ريال</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">ريال</th>
              <th className="border-l-2 border-black p-1 border-t border-black text-[10px] text-gray-600">ريال</th>
              <th className="p-1 border-t border-black text-[10px] text-red-800">ريال</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white hover:bg-gray-50/50">
              <td className="border-l-2 border-black p-2 font-mono font-bold text-slate-800">{readingFormat(currentReading)}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-slate-800">{readingFormat(previousReading)}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-blue-700">{readingFormat(actualConsumption)}</td>
              <td className={`border-l-2 border-black p-2 font-mono font-bold ${isEstimated ? 'text-amber-700' : 'text-gray-300'}`}>{isEstimated ? readingFormat(storedConsumption) : '—'}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-purple-700">{Number(bill.workUnits) > 0 ? Number(bill.workUnits) : '—'}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-emerald-700">{formatNum(consumptionCost)}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-sky-700">{serviceFee > 0 ? formatNum(serviceFee) : '—'}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-rose-600">{fine > 0 ? formatNum(fine) : '—'}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-emerald-600">{exemption > 0 ? formatNum(exemption) : '—'}</td>
              <td className="border-l-2 border-black p-2 font-mono font-bold text-gray-800">{formatNum(monthTotal)}</td>
              <td className="border-l-2 border-black p-2 font-mono font-extrabold text-rose-700">{formatNum(arrears)}</td>
              <td className="p-2 font-mono font-extrabold text-lg text-red-900 bg-red-50">{formatNum(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AMOUNT IN WORDS */}
      <div className="text-right text-xs font-bold border-2 border-black p-2 bg-gradient-to-r from-amber-50 to-white rounded-sm">
        <span>المبلغ المستحق كتابةً: </span>
        <span className="border-b-2 border-dotted border-black px-2 text-rose-700 font-extrabold text-sm">{totalWords} ريال يمني</span>
        <span> لا غير</span>
      </div>

      {/* NOTES & CONDITIONS */}
      <div className="text-[10px] space-y-1 text-slate-800 leading-relaxed border-2 border-black p-2.5 bg-gradient-to-r from-gray-50 to-white rounded-sm">
        <p className="font-bold text-center border-b border-gray-300 pb-1 mb-1 text-xs">⚠️ الضوابط والإرشادات</p>
        <p>• يجب تسديد المبلغ أولاً بأول وعدم التأخير لتجنب انقطاع الخدمة.</p>
        <p>• لا يحق للمشترك العبث بالعداد أو التلاعب به، ويتم ذلك فقط بإشراف مباشر من إدارة المشروع.</p>
        <p className="font-bold text-rose-700">• يمنع منعاً باتاً استخدام مياه المشروع لسقي القات. المخالف يدفع غرامة مالية قدرها 30,000 ريال يمني مع سحب العداد.</p>
        <p>• الحد الأدنى للفاتورة هو 1,000 ريال حتى في حالة عدم الاستهلاك.</p>
      </div>

      {/* FOOTER */}
      <div className="flex justify-between items-center text-[9px] text-gray-500 pt-2 border-t-2 border-black">
        <span>تاريخ الطباعة: {new Date().toLocaleDateString("ar-YE")} {new Date().toLocaleTimeString("ar-YE", { hour: "2-digit", minute: "2-digit" })}</span>
        <span className="font-mono text-[8px] text-gray-400">سعر الشريحة: 0-4 = 700 ريال/م³ | 5+ = 1,000 ريال/م³ | وحدة العمل = 2,000 ريال</span>
      </div>

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
