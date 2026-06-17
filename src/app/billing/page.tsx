"use client";

import { useEffect, useState } from "react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import Link from "next/link";

interface BillingCycle {
  id: string;
  year: number;
  month: number;
  status: 'DRAFT' | 'ISSUED' | 'CLOSED';
  issuedAt: string | null;
  _count?: {
    bills: number;
  };
}

interface Bill {
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
  meterPhotoUrl: string | null;
  notes: string | null;
  customer: {
    accountNumber: string;
    name: string;
  };
}

export default function BillingPage() {
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<BillingCycle | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);

  // Editing state
  const [readings, setReadings] = useState<Record<string, {
    currentReading: number;
    meterPhotoUrl: string | null;
    notes: string | null;
    consumption: number;
    totalAmount: number;
  }>>({});
  const [savingReadings, setSavingReadings] = useState(false);
  const [uploadingBillId, setUploadingBillId] = useState<string | null>(null);

  // Pricing constants (defaults)
  const PRICING = {
    workUnitPrice: 2000,
    tier1Limit: 4,
    tier1Price: 700,
    tier2Price: 1000,
  };

  const fetchCycles = async () => {
    try {
      setLoadingCycles(true);
      const res = await fetch("/api/billing");
      if (!res.ok) throw new Error("فشل جلب دورات الفوترة");
      const data = await res.json();
      setCycles(data);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setLoadingCycles(false);
    }
  };

  const fetchCycleBills = async (cycle: BillingCycle) => {
    try {
      setLoadingBills(true);
      setActiveCycle(cycle);
      const res = await fetch(`/api/billing/${cycle.id}`);
      if (!res.ok) throw new Error("فشل جلب فواتير الدورة");
      const data = await res.json();
      setBills(data.bills || []);

      // Initialize readings state with calculated values
      const initialReadings: typeof readings = {};
      (data.bills || []).forEach((b: Bill) => {
        initialReadings[b.id] = {
          currentReading: Number(b.currentReading),
          meterPhotoUrl: b.meterPhotoUrl,
          notes: b.notes,
          consumption: Number(b.consumption),
          totalAmount: Number(b.totalAmount),
        };
      });
      setReadings(initialReadings);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const calculateClientSide = (billId: string, current: number) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    const previous = Number(bill.previousReading);
    const workUnits = bill.workUnits;

    const consumption = Math.max(current - previous, 0);
    const workUnitsTotal = workUnits * PRICING.workUnitPrice;

    const tier1Units = Math.min(consumption, PRICING.tier1Limit);
    const tier1Cost = tier1Units * PRICING.tier1Price;

    const tier2Units = Math.max(consumption - PRICING.tier1Limit, 0);
    const tier2Cost = tier2Units * PRICING.tier2Price;

    const totalAmount = workUnitsTotal + tier1Cost + tier2Cost;

    setReadings(prev => ({
      ...prev,
      [billId]: {
        ...prev[billId],
        currentReading: current,
        consumption,
        totalAmount,
      }
    }));
  };

  const handleReadingChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    calculateClientSide(billId, numeric);
  };

  const handleUploadPhoto = async (billId: string, file: File) => {
    try {
      setUploadingBillId(billId);
      const url = await uploadToCloudinary(file);
      setReadings(prev => ({
        ...prev,
        [billId]: {
          ...prev[billId],
          meterPhotoUrl: url,
        }
      }));
    } catch (err: any) {
      alert(err.message || "فشل تحميل الصورة");
    } finally {
      setUploadingBillId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!activeCycle) return;
    try {
      setSavingReadings(true);
      const entries = Object.entries(readings).map(([billId, data]) => ({
        billId,
        currentReading: data.currentReading,
        meterPhotoUrl: data.meterPhotoUrl,
        notes: data.notes,
      }));

      const res = await fetch(`/api/billing/${activeCycle.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل حفظ القراءات");
      
      alert("تم حفظ جميع القراءات بنجاح!");
      fetchCycleBills(activeCycle);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSavingReadings(false);
    }
  };

  const handleIssueCycle = async () => {
    if (!activeCycle) return;
    const confirmIssue = confirm(
      "هل أنت متأكد من إصدار هذه الدورة؟ بعد الإصدار، ستصبح الفواتير نهائية ومغلقة للتعديل، وسيتم فتح خيار طباعة الفواتير للمشتركين."
    );
    if (!confirmIssue) return;

    try {
      setSavingReadings(true);
      const res = await fetch(`/api/billing/${activeCycle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ISSUED" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إصدار دورة الفوترة");

      alert("تم إصدار الدورة وقفلها بنجاح!");
      fetchCycles();
      fetchCycleBills(data);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSavingReadings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">قراءة العدادات وإصدار الفواتير</h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">إدخال القراءات الشهرية جماعياً للمشتركين وإصدار دورات الفوترة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side: Cycles List */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">دورات الفوترة</h3>
          {loadingCycles ? (
            <div className="text-center py-6 text-slate-400 text-xs">جاري جلب الدورات...</div>
          ) : cycles.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">لا يوجد دورات مسجلة.</div>
          ) : (
            <div className="space-y-2">
              {cycles.map((c) => (
                <button
                  key={c.id}
                  onClick={() => fetchCycleBills(c)}
                  className={`w-full text-right p-3 rounded-lg border text-sm transition-all flex flex-col space-y-1 ${
                    activeCycle?.id === c.id
                      ? "border-brand-500 bg-brand-50/50 text-brand-900"
                      : "border-slate-100 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold">الشهر: {c.year}/{String(c.month).padStart(2, '0')}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.status === 'ISSUED' ? 'bg-emerald-50 text-emerald-700' :
                      c.status === 'CLOSED' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {c.status === 'ISSUED' ? 'تم الإصدار' : c.status === 'CLOSED' ? 'مغلق' : 'مسودة'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    ({c._count?.bills || 0}) فاتورة مسجلة
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Bills Batch Form */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {!activeCycle ? (
            <div className="text-center py-20 text-slate-400">
              👈 يرجى اختيار دورة فوترة من القائمة الجانبية لعرض الفواتير أو بدء إدخال القراءات.
            </div>
          ) : loadingBills ? (
            <div className="text-center py-20 text-slate-500">جاري تحميل الفواتير والدفتر الحسابي للدورة...</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    دفتر قراءات دورة: {activeCycle.year}/{String(activeCycle.month).padStart(2, '0')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    حالة الدورة: {activeCycle.status === 'ISSUED' ? 'تم الإصدار وقفل التعديل' : 'مسودة - قابلة للتعديل'}
                  </p>
                </div>
                
                {activeCycle.status === 'DRAFT' && (
                  <div className="flex space-x-2 space-x-reverse">
                    <button
                      onClick={handleSaveAll}
                      disabled={savingReadings}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      💾 حفظ التعديلات
                    </button>
                    <button
                      onClick={handleIssueCycle}
                      disabled={savingReadings}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      🔒 إصدار وقفل الدورة
                    </button>
                  </div>
                )}

                {activeCycle.status === 'ISSUED' && (
                  <Link
                    href={`/print/batch/${activeCycle.id}`}
                    target="_blank"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-sm px-4 py-2 rounded-xl transition-colors"
                  >
                    🖨️ طباعة فواتير الدورة جماعياً (A4/A5)
                  </Link>
                )}
              </div>

              {/* Tabular Form */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="p-3">حساب</th>
                      <th className="p-3">الاسم</th>
                      <th className="p-3">وحدات العمل</th>
                      <th className="p-3">القراءة السابقة</th>
                      <th className="p-3">القراءة الحالية</th>
                      <th className="p-3">الاستهلاك</th>
                      <th className="p-3">رسوم الوحدات</th>
                      <th className="p-3">الشريحة الأولى</th>
                      <th className="p-3">الشريحة الثانية</th>
                      <th className="p-3">المبلغ الإجمالي</th>
                      <th className="p-3">صورة العداد</th>
                      <th className="p-3">ملاحظات</th>
                      {activeCycle.status === 'ISSUED' && <th className="p-3 text-center">الفاتورة</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {bills.map((b) => {
                      const currentReadingInput = readings[b.id]?.currentReading ?? 0;
                      const calculatedConsumption = readings[b.id]?.consumption ?? 0;
                      const calculatedTotal = readings[b.id]?.totalAmount ?? 0;
                      const currentPhoto = readings[b.id]?.meterPhotoUrl;

                      const consumption = calculatedConsumption;
                      const workUnitsTotal = b.workUnits * PRICING.workUnitPrice;
                      const tier1Units = Math.min(consumption, PRICING.tier1Limit);
                      const tier1Cost = tier1Units * PRICING.tier1Price;
                      const tier2Units = Math.max(consumption - PRICING.tier1Limit, 0);
                      const tier2Cost = tier2Units * PRICING.tier2Price;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-700">{b.customer.accountNumber}</td>
                          <td className="p-3 font-semibold text-slate-800">{b.customer.name}</td>
                          <td className="p-3 text-slate-600">{b.workUnits}</td>
                          <td className="p-3 text-slate-600">{Number(b.previousReading)}</td>
                          <td className="p-3">
                            <input
                              type="number"
                              step="any"
                              disabled={activeCycle.status !== 'DRAFT'}
                              value={currentReadingInput}
                              onChange={(e) => handleReadingChange(b.id, e.target.value)}
                              className="w-24 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          </td>
                          <td className="p-3 font-bold text-slate-700">{calculatedConsumption.toFixed(2)}</td>
                          <td className="p-3 text-slate-600">{workUnitsTotal.toLocaleString()} ريال</td>
                          <td className="p-3 text-slate-600">{tier1Units.toFixed(2)} × {PRICING.tier1Price} = {tier1Cost.toLocaleString()} ريال</td>
                          <td className="p-3 text-slate-600">{tier2Units.toFixed(2)} × {PRICING.tier2Price} = {tier2Cost.toLocaleString()} ريال</td>
                          <td className="p-3 font-extrabold text-brand-600">{calculatedTotal.toLocaleString()} ريال</td>
                          <td className="p-3">
                            {activeCycle.status === 'DRAFT' ? (
                              <div className="flex items-center space-x-1 space-x-reverse">
                                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-[10px] font-semibold border border-slate-200">
                                  📸 رفع
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadPhoto(b.id, file);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                                {uploadingBillId === b.id && <span className="text-[9px] text-slate-400">جاري الرفع...</span>}
                                {currentPhoto && (
                                  <a href={currentPhoto} target="_blank" className="text-emerald-600 text-xs">✔️</a>
                                )}
                              </div>
                            ) : (
                              currentPhoto ? (
                                <a href={currentPhoto} target="_blank" className="text-brand-600 hover:underline text-[10px]">عرض الصورة</a>
                              ) : "—"
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              disabled={activeCycle.status !== 'DRAFT'}
                              value={readings[b.id]?.notes || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReadings(prev => ({
                                  ...prev,
                                  [b.id]: {
                                    ...prev[b.id],
                                    notes: val
                                  }
                                }));
                              }}
                              placeholder="لا يوجد"
                              className="w-28 border border-slate-200 rounded-lg p-1 text-xs focus:outline-none disabled:bg-transparent disabled:border-none"
                            />
                          </td>
                          {activeCycle.status === 'ISSUED' && (
                            <td className="p-3 text-center">
                              <Link
                                href={`/print/bill/${b.id}`}
                                target="_blank"
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] px-2 py-1 rounded font-bold border border-slate-200"
                              >
                                🖨️ طباعة
                              </Link>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
