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
  serviceFee: string;
  fine: string;
  exemption: string;
  totalAmount: string;
  paidAmount: string;
  notes: string | null;
  createdAt: string;
  arrears?: number;
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
  "", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default function BatchBillsPrint() {
  const params = useParams();
  const cycleId = params.cycleId as string;
  const [bills, setBills] = useState<BillData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cycleId) return;
    const fetchBills = async () => {
      try {
        const response = await fetch(`/api/billing/${cycleId}`);
        if (!response.ok) throw new Error("فشل تحميل فواتير الدورة");
        const data = await response.json();
        setBills(data.bills || []);
      } catch (err) {
        console.error("Batch print fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBills();
  }, [cycleId]);

  useEffect(() => {
    if (bills.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [bills]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-slate-500 font-medium no-print">
        جاري تجهيز دفعة الفواتير للطباعة...
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen text-rose-500 font-bold no-print">
        لا توجد فواتير في هذه الدورة للطباعة.
      </div>
    );
  }

  return (
    <div className="space-y-8 print-container p-0">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between text-amber-800 max-w-lg mx-auto no-print">
        <div className="text-xs font-semibold">
          تم تجهيز ({bills.length}) فاتورة للطباعة.
        </div>
        <button
          onClick={() => window.print()}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded transition-colors"
        >
          🖨️ بدء الطباعة
        </button>
      </div>

      {bills.map((bill) => {
        const previousReading = Number(bill.previousReading);
        const currentReading = Number(bill.currentReading);
        const actualConsumption = Math.max(currentReading - previousReading, 0);
        const storedConsumption = Number(bill.consumption);
        const isEstimated = storedConsumption !== actualConsumption && storedConsumption > 0;

        const tier1Cost = Number(bill.tier1Cost);
        const tier2Cost = Number(bill.tier2Cost);
        const MINIMUM_FEE = 1000;
        const consumptionCost = Math.max(tier1Cost + tier2Cost, MINIMUM_FEE);

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
          <div
            key={bill.id}
            className="bill-page-break bg-white p-6 max-w-[21cm] mx-auto text-black font-sans dir-rtl print:border-none print:shadow-none print:p-4"
          >
            {/* === الترويسة === */}
            <div className="border-b-2 border-black pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 space-x-reverse">
                  <img
                    src="/logo.svg"
                    alt="شعار المشروع"
                    className="w-16 h-16 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="text-right">
                    <h1 className="text-lg font-extrabold tracking-wide">الجمهورية اليمنية - محافظة تعز</h1>
                    <h2 className="text-base font-bold mt-0.5">مشروع مياه غيل الضياء</h2>
                    <p className="text-sm font-semibold text-gray-600 mt-0.5">فاتورة استهلاك مياه</p>
                  </div>
                </div>
                <div className="text-left border border-black bg-gray-50 px-5 py-2 rounded">
                  <p className="text-xs font-bold">رقم: {bill.billNumber}</p>
                </div>
              </div>
            </div>

            {/* === بيانات العميل === */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm border border-black p-3 mb-4 bg-gray-50/30">
              <div className="flex justify-between border-l border-gray-300 pl-2">
                <span className="text-gray-600">رقم المشترك:</span>
                <span className="font-bold">{bill.customer.accountNumber}</span>
              </div>
              <div className="flex justify-between border-l border-gray-300 pl-2">
                <span className="text-gray-600">اسم المشترك:</span>
                <span className="font-bold">{bill.customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">رقم العداد:</span>
                <span className="font-bold">{bill.customer.meterNumber || "—"}</span>
              </div>
              <div className="flex justify-between border-l border-gray-300 pl-2">
                <span className="text-gray-600">الشهر:</span>
                <span className="font-bold">{ARABIC_MONTHS[bill.billingCycle.month]} {bill.billingCycle.year}</span>
              </div>
              <div className="flex justify-between border-l border-gray-300 pl-2">
                <span className="text-gray-600">تاريخ الفاتورة:</span>
                <span className="font-bold">{new Date(bill.createdAt).toLocaleDateString("ar-YE")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">المنطقة:</span>
                <span className="font-bold">{bill.customer.address || "—"}</span>
              </div>
            </div>

            {/* === جدول تفاصيل الفاتورة === */}
            <div className="border border-black mb-4">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-black">
                    <th className="border-l border-black p-2 text-center font-bold text-xs">البيان</th>
                    <th className="p-2 text-center font-bold text-xs">القيمة (ريال)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                    <td className="border-l border-gray-200 p-2 pr-4 font-semibold">المتأخرات السابقة</td>
                    <td className="p-2 text-center font-mono font-bold text-rose-700">{formatNum(arrears)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                    <td className="border-l border-gray-200 p-2 pr-4">القراءة السابقة</td>
                    <td className="p-2 text-center font-mono">{readingFormat(previousReading)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                    <td className="border-l border-gray-200 p-2 pr-4">القراءة الحالية</td>
                    <td className="p-2 text-center font-mono">{readingFormat(currentReading)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                    <td className="border-l border-gray-200 p-2 pr-4">الاستهلاك الفعلي</td>
                    <td className="p-2 text-center font-mono">{readingFormat(actualConsumption)}</td>
                  </tr>
                  {isEstimated && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                      <td className="border-l border-gray-200 p-2 pr-4 text-amber-700">الاستهلاك التقديري</td>
                      <td className="p-2 text-center font-mono text-amber-700">{readingFormat(storedConsumption)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                    <td className="border-l border-gray-200 p-2 pr-4">قيمة الاستهلاك (الحد الأدنى {formatNum(MINIMUM_FEE)} ريال)</td>
                    <td className="p-2 text-center font-mono font-bold">{formatNum(consumptionCost)}</td>
                  </tr>
                  {(serviceFee > 0) && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                      <td className="border-l border-gray-200 p-2 pr-4">رسوم الخدمات</td>
                      <td className="p-2 text-center font-mono">{formatNum(serviceFee)}</td>
                    </tr>
                  )}
                  {(fine > 0) && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                      <td className="border-l border-gray-200 p-2 pr-4 text-rose-600">الغرامات</td>
                      <td className="p-2 text-center font-mono text-rose-600">{formatNum(fine)}</td>
                    </tr>
                  )}
                  {(exemption > 0) && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                      <td className="border-l border-gray-200 p-2 pr-4 text-emerald-600">الإعفاءات</td>
                      <td className="p-2 text-center font-mono text-emerald-600">({formatNum(exemption)})</td>
                    </tr>
                  )}
                  {(bill.workUnits > 0) && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50/50">
                      <td className="border-l border-gray-200 p-2 pr-4">وحدات العمل ({bill.workUnits} وحدة)</td>
                      <td className="p-2 text-center font-mono">{formatNum(Number(bill.workUnitsTotal))}</td>
                    </tr>
                  )}
                  <tr className="border-b border-black bg-gray-50 font-bold">
                    <td className="border-l border-black p-2 pr-4 text-base">إجمالي الشهر</td>
                    <td className="p-2 text-center font-mono text-base">{formatNum(monthTotal)}</td>
                  </tr>
                  <tr className="bg-gray-100 font-extrabold">
                    <td className="border-l border-black p-2 pr-4 text-base">إجمالي الفاتورة (شامل المتأخرات)</td>
                    <td className="p-2 text-center font-mono text-lg text-rose-700">{formatNum(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* === المبلغ بالكتابة === */}
            <div className="text-right text-sm font-bold border border-black p-2 mb-4 bg-gray-50/30">
              <span>المبلغ المستحق: </span>
              <span className="border-b border-dotted border-black px-2 text-rose-700">{totalWords} ريال يمني</span>
              <span> لا غير</span>
            </div>

            {/* === الضوابط والشروط === */}
            <div className="text-xs space-y-1.5 text-slate-800 leading-relaxed border border-black p-3 mb-4 bg-gray-50/30">
              <p className="font-bold text-center border-b border-gray-300 pb-1.5 mb-1.5">الضوابط والشروط</p>
              <p>1. التزام السداد: يجب تسديد المبلغ أولاً بأول وعدم التأخير لتجنب انقطاع الخدمة.</p>
              <p>2. حظر العبث: لا يحق للمشترك العبث بالعداد أو التلاعب به إلا بإشراف مباشر من إدارة المشروع.</p>
              <p className="font-bold text-rose-700">3. يمنع منعاً باتاً استخدام مياه المشروع لسقي القات. المخالف يدفع غرامة مالية قدرها 30,000 ريال يمني مع سحب العداد.</p>
              <p>4. الحد الأدنى: يتم دفع 1,000 ريال كحد أدنى للرسوم حتى في حالة عدم الاستهلاك.</p>
            </div>

            {/* === التوقيع والختم === */}
            <div className="flex justify-between items-center text-sm border-t-2 border-black pt-4 mb-4">
              <div className="text-center">
                <p className="font-bold mb-1">الختم</p>
                <div className="w-24 h-8 border border-dashed border-gray-400 mx-auto rounded"></div>
              </div>
              <div className="text-center">
                <p className="font-bold mb-1">توقيع المحصل</p>
                <div className="w-32 h-8 border border-dashed border-gray-400 mx-auto rounded"></div>
              </div>
              <div className="text-left text-[10px] text-gray-500">
                <p>تاريخ الطباعة: {new Date().toLocaleDateString("ar-YE")}</p>
                <p>{new Date().toLocaleTimeString("ar-YE", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}