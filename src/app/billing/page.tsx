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

type UnitType = 'regular' | 'work' | 'both';

const PRICING = {
  workUnitPrice: 2000,
  tier1Limit: 4,
  tier1Price: 700,
  tier2Price: 1000,
};

function calcClient(previous: number, current: number, workUnits: number) {
  const consumption = Math.max(current - previous, 0);
  const workUnitsTotal = workUnits * PRICING.workUnitPrice;
  const unitPrice = consumption <= PRICING.tier1Limit ? PRICING.tier1Price : PRICING.tier2Price;
  const consumptionCost = consumption * unitPrice;
  const totalAmount = workUnitsTotal + consumptionCost;
  return { consumption, workUnitsTotal, unitPrice, consumptionCost, totalAmount };
}

export default function BillingPage() {
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<BillingCycle | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [isPendingMode, setIsPendingMode] = useState(false);

  const [readings, setReadings] = useState<Record<string, {
    currentReading: number;
    workUnits: number;
    meterPhotoUrl: string | null;
    notes: string | null;
    consumption: number;
    consumptionManual: boolean;
    workUnitsTotal: number;
    unitPrice: number;
    consumptionCost: number;
    totalAmount: number;
  }>>({});
  const [unitTypes, setUnitTypes] = useState<Record<string, UnitType>>({});
  const [savingReadings, setSavingReadings] = useState(false);
  const [uploadingBillId, setUploadingBillId] = useState<string | null>(null);

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

      if (data.pendingCustomers && data.pendingCustomers.length > 0) {
        setIsPendingMode(true);
        const virtualBills = data.pendingCustomers.map((c: any) => ({
          id: `pending_${c.customerId}`,
          billNumber: c.billNumber,
          previousReading: String(c.previousReading),
          currentReading: String(c.previousReading),
          consumption: "0",
          workUnits: c.workUnits,
          workUnitsTotal: "0",
          tier1Units: "0",
          tier1Cost: "0",
          tier2Units: "0",
          tier2Cost: "0",
          totalAmount: "0",
          meterPhotoUrl: null,
          notes: null,
          customer: c.customer,
          _customerId: c.customerId,
        }));
        setBills(virtualBills);

        const initR: typeof readings = {};
        const initU: Record<string, UnitType> = {};
        virtualBills.forEach((b: any) => {
          initU[b.id] = 'regular';
          initR[b.id] = {
            currentReading: Number(b.previousReading),
            workUnits: 0,
            meterPhotoUrl: null,
            notes: null,
            consumption: 0,
            consumptionManual: false,
            workUnitsTotal: 0,
            unitPrice: PRICING.tier1Price,
            consumptionCost: 0,
            totalAmount: 0,
          };
        });
        setReadings(initR);
        setUnitTypes(initU);
      } else {
        setIsPendingMode(false);
        const existingBills = data.bills || [];
        setBills(existingBills);

        const initR: typeof readings = {};
        const initU: Record<string, UnitType> = {};
        existingBills.forEach((b: Bill) => {
          const consumption = Number(b.consumption);
          const work = b.workUnits;
          if (work > 0 && consumption > 0) initU[b.id] = 'both';
          else if (work > 0) initU[b.id] = 'work';
          else initU[b.id] = 'regular';

          const prevCalc = calcClient(Number(b.previousReading), Number(b.currentReading), work);
          initR[b.id] = {
            currentReading: Number(b.currentReading),
            workUnits: work,
            meterPhotoUrl: b.meterPhotoUrl,
            notes: b.notes,
            consumption: prevCalc.consumption,
            consumptionManual: false,
            workUnitsTotal: prevCalc.workUnitsTotal,
            unitPrice: prevCalc.unitPrice,
            consumptionCost: prevCalc.consumptionCost,
            totalAmount: prevCalc.totalAmount,
          };
        });
        setReadings(initR);
        setUnitTypes(initU);
      }
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const recalc = (billId: string, overrides?: { currentReading?: number; workUnits?: number; consumption?: number }) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const r = readings[billId];
    if (!r) return;

    const previous = Number(bill.previousReading);
    const current = overrides?.currentReading ?? r.currentReading;
    const work = overrides?.workUnits ?? r.workUnits;

    let consumption: number;
    let consumptionManual: boolean;

    if (overrides?.consumption !== undefined) {
      consumption = overrides.consumption;
      consumptionManual = true;
    } else if (r.consumptionManual && overrides?.consumption === undefined && overrides?.currentReading === undefined) {
      consumption = r.consumption;
      consumptionManual = true;
    } else {
      consumption = Math.max(current - previous, 0);
      consumptionManual = false;
    }

    const calc = calcClient(previous, current, work);
    setReadings(prev => ({
      ...prev,
      [billId]: {
        ...prev[billId],
        currentReading: current,
        workUnits: work,
        consumption,
        consumptionManual,
        workUnitsTotal: calc.workUnitsTotal,
        unitPrice: calc.unitPrice,
        consumptionCost: consumption * calc.unitPrice,
        totalAmount: calc.workUnitsTotal + consumption * calc.unitPrice,
      }
    }));
  };

  const handleUnitTypeChange = (billId: string, unitType: UnitType) => {
    setUnitTypes(prev => ({ ...prev, [billId]: unitType }));
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const previous = Number(bill.previousReading);

    if (unitType === 'regular') {
      recalc(billId, { workUnits: 0 });
    } else if (unitType === 'work') {
      const defaultWork = bill.workUnits || 1;
      recalc(billId, { currentReading: previous, workUnits: defaultWork });
    } else {
      const defaultWork = bill.workUnits || 1;
      recalc(billId, { workUnits: defaultWork });
    }
  };

  const handleReadingChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { currentReading: numeric });
  };

  const handleWorkUnitsChange = (billId: string, value: string) => {
    const numeric = parseInt(value) || 0;
    recalc(billId, { workUnits: numeric });
  };

  const handleUploadPhoto = async (billId: string, file: File) => {
    try {
      setUploadingBillId(billId);
      const url = await uploadToCloudinary(file);
      setReadings(prev => ({
        ...prev,
        [billId]: { ...prev[billId], meterPhotoUrl: url }
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
      const entries = Object.entries(readings).map(([id, data]) => {
        const bill = bills.find(b => b.id === id);
        if (!bill) return null;

        const entry: any = {
          currentReading: data.currentReading,
          workUnits: data.workUnits,
          meterPhotoUrl: data.meterPhotoUrl,
          notes: data.notes,
        };

        if (isPendingMode) {
          entry.customerId = (bill as any)._customerId;
        } else {
          entry.billId = id;
        }

        return entry;
      }).filter(Boolean);

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

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="p-3">حساب</th>
                      <th className="p-3">الاسم</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">القراءة السابقة</th>
                      <th className="p-3">القراءة الحالية</th>
                      <th className="p-3">وحدات العمل</th>
                      <th className="p-3">الاستهلاك</th>
                      <th className="p-3">رسوم الوحدات</th>
                      <th className="p-3">قيمة الاستهلاك</th>
                      <th className="p-3">المبلغ الإجمالي</th>
                      <th className="p-3">صورة العداد</th>
                      <th className="p-3">ملاحظات</th>
                      {activeCycle.status === 'ISSUED' && <th className="p-3 text-center">الفاتورة</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {bills.map((b) => {
                      const r = readings[b.id];
                      const ut = unitTypes[b.id] || 'regular';
                      const calc = r ? calcClient(Number(b.previousReading), r.currentReading, r.workUnits) : null;
                      const canEdit = activeCycle.status === 'DRAFT';

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-slate-700">{b.customer.accountNumber}</td>
                          <td className="p-3 font-semibold text-slate-800">{b.customer.name}</td>

                          {/* Type selector */}
                          <td className="p-3">
                            {canEdit ? (
                              <select
                                value={ut}
                                onChange={(e) => handleUnitTypeChange(b.id, e.target.value as UnitType)}
                                className="border border-slate-200 rounded-lg p-1 text-[10px] font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                              >
                                <option value="regular">عادي</option>
                                <option value="work">وحدات عمل</option>
                                <option value="both">كلاهما</option>
                              </select>
                            ) : (
                              <span className="text-slate-600">
                                {ut === 'regular' ? 'عادي' : ut === 'work' ? 'وحدات عمل' : 'كلاهما'}
                              </span>
                            )}
                          </td>

                          {/* Previous Reading */}
                          <td className="p-3 text-slate-600">
                            {(ut === 'regular' || ut === 'both') ? Number(b.previousReading) : '—'}
                          </td>

                          {/* Current Reading */}
                          <td className="p-3">
                            {(ut === 'regular' || ut === 'both') ? (
                              <input
                                type="number"
                                step="any"
                                disabled={!canEdit}
                                value={r?.currentReading ?? Number(b.previousReading)}
                                onChange={(e) => handleReadingChange(b.id, e.target.value)}
                                className="w-24 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            ) : '—'}
                          </td>

                          {/* Work Units */}
                          <td className="p-3">
                            {(ut === 'work' || ut === 'both') ? (
                              <input
                                type="number"
                                min={0}
                                disabled={!canEdit}
                                value={r?.workUnits ?? 0}
                                onChange={(e) => handleWorkUnitsChange(b.id, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            ) : '—'}
                          </td>

                          {/* Consumption */}
                          <td className="p-3">
                            {(ut === 'regular' || ut === 'both') ? (
                              <input
                                type="number"
                                step="any"
                                min={0}
                                disabled={!canEdit}
                                value={r?.consumption ?? 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  recalc(b.id, { consumption: val });
                                }}
                                className="w-20 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            ) : (
                              <span className="font-bold text-slate-700">0.00</span>
                            )}
                          </td>

                          {/* Work Units Total */}
                          <td className="p-3 text-slate-600">
                            {(ut === 'work' || ut === 'both') ? ((r?.workUnitsTotal ?? 0).toLocaleString() + ' ريال') : '—'}
                          </td>

                          {/* Consumption Cost (flat pricing) */}
                          <td className="p-3 text-slate-600">
                            {(ut === 'regular' || ut === 'both') && calc ? (
                              <>{calc.consumption.toFixed(2)} × {calc.unitPrice} = {calc.consumptionCost.toLocaleString()} ريال</>
                            ) : '—'}
                          </td>

                          {/* Total */}
                          <td className="p-3 font-extrabold text-brand-600">
                            {(r?.totalAmount ?? 0).toLocaleString()} ريال
                          </td>

                          {/* Photo */}
                          <td className="p-3">
                            {canEdit ? (
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
                                {r?.meterPhotoUrl && (
                                  <a href={r.meterPhotoUrl} target="_blank" className="text-emerald-600 text-xs">✔️</a>
                                )}
                              </div>
                            ) : (
                              r?.meterPhotoUrl ? (
                                <a href={r.meterPhotoUrl} target="_blank" className="text-brand-600 hover:underline text-[10px]">عرض الصورة</a>
                              ) : "—"
                            )}
                          </td>

                          {/* Notes */}
                          <td className="p-3">
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={r?.notes || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReadings(prev => ({
                                  ...prev,
                                  [b.id]: { ...prev[b.id], notes: val }
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
