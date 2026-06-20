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
  workUnits: number | string;
  workUnitsTotal: string;
  tier1Units: string;
  tier1Cost: string;
  tier2Units: string;
  tier2Cost: string;
  serviceFee: string;
  fine: string;
  exemption: string;
  totalAmount: string;
  arrears?: number;
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

function calcClient(consumption: number, workUnits: number, serviceFee = 0, fine = 0, exemption = 0) {
  const workUnitsTotal = workUnits * PRICING.workUnitPrice;
  const t1Units = Math.min(consumption, PRICING.tier1Limit);
  const t1Cost = t1Units * PRICING.tier1Price;
  const t2Units = Math.max(consumption - PRICING.tier1Limit, 0);
  const t2Cost = t2Units * PRICING.tier2Price;
  const rawConsumptionCost = t1Cost + t2Cost;
  const MINIMUM_FEE = 1000;
  const consumptionCost = Math.max(rawConsumptionCost, MINIMUM_FEE);
  const totalAmount = workUnitsTotal + consumptionCost + serviceFee + fine - exemption;
  return { consumption, workUnitsTotal, t1Units, t1Cost, t2Units, t2Cost, consumptionCost, totalAmount };
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
    actualConsumption: number;
    estimatedConsumption: number;
    readingWarning: boolean;
    workUnitsTotal: number;
    consumptionCost: number;
    serviceFee: number;
    fine: number;
    exemption: number;
    totalAmount: number;
    arrears: number;
  }>>({});
  const [unitTypes, setUnitTypes] = useState<Record<string, UnitType>>({});
  const [savingReadings, setSavingReadings] = useState(false);
  const [savingBillId, setSavingBillId] = useState<string | null>(null);
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

      // Merge existing bills with pending customers
      const existingBills = data.bills || [];
      const pending = data.pendingCustomers || [];
      const hasPending = pending.length > 0;

      let mergedBills: any[] = [];

      if (hasPending) {
        setIsPendingMode(true);
        // Create virtual bills for pending customers
        const virtualBills = pending.map((c: any) => ({
          id: `pending_${c.customerId}`,
          billNumber: c.billNumber,
          previousReading: String(c.previousReading),
          currentReading: String(c.previousReading),
          consumption: "0",
          workUnits: Number(c.workUnits),
          workUnitsTotal: "0",
          tier1Units: "0",
          tier1Cost: "0",
          tier2Units: "0",
          tier2Cost: "0",
          totalAmount: "0",
          arrears: 0,
          meterPhotoUrl: null,
          notes: null,
          customer: c.customer,
          _customerId: c.customerId,
        }));
        mergedBills = [...existingBills, ...virtualBills];
      } else {
        setIsPendingMode(false);
        mergedBills = existingBills;
      }

      setBills(mergedBills);

      const initR: typeof readings = {};
      const initU: Record<string, UnitType> = {};
      mergedBills.forEach((b: any) => {
        const isPending = b.id.startsWith('pending_');
        const storedConsumption = Number(b.consumption || 0);
        const work = Number(b.workUnits) || 0;
        const prevReading = Number(b.previousReading);

        // currentReading = previousReading + regularUnits + workUnits
        const currReading = isPending && work > 0
          ? prevReading + work
          : (isPending ? prevReading : Number(b.currentReading));

        // total consumption = curr - prev (includes work units for display)
        const totalConsumption = Math.max(currReading - prevReading, 0);
        // regular consumption for tiered pricing (excludes work units)
        const regularConsumption = Math.max(totalConsumption - work, 0);

        const estimatedConsumption = (storedConsumption > 0 && Math.abs(storedConsumption - totalConsumption) > 0.01) ? storedConsumption : 0;

        const effectiveConsumption = estimatedConsumption > 0 ? estimatedConsumption : regularConsumption;

        initU[b.id] = (work > 0 && totalConsumption > 0) ? 'both' : (work > 0) ? 'work' : 'regular';

        const sf = Number(b.serviceFee) || 0;
        const fn = Number(b.fine) || 0;
        const ex = Number(b.exemption) || 0;
        const prevCalc = calcClient(effectiveConsumption, work, sf, fn, ex);

        initR[b.id] = {
          currentReading: currReading,
          workUnits: work,
          meterPhotoUrl: b.meterPhotoUrl || null,
          notes: b.notes || null,
          actualConsumption: totalConsumption,
          estimatedConsumption: estimatedConsumption,
          readingWarning: currReading < prevReading,
          workUnitsTotal: prevCalc.workUnitsTotal,
          consumptionCost: prevCalc.consumptionCost,
          serviceFee: sf,
          fine: fn,
          exemption: ex,
          totalAmount: prevCalc.totalAmount,
          arrears: b.arrears || 0,
        };
      });
      setReadings(initR);
      setUnitTypes(initU);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const recalc = (billId: string, overrides?: { currentReading?: number; workUnits?: number; estimatedConsumption?: number; serviceFee?: number; fine?: number; exemption?: number }) => {
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const r = readings[billId];
    if (!r) return;

    const previous = Number(bill.previousReading);
    const current = overrides?.currentReading ?? r.currentReading;
    const work = overrides?.workUnits ?? r.workUnits;
    const serviceFee = overrides?.serviceFee ?? r.serviceFee;
    const fine = overrides?.fine ?? r.fine;
    const exemption = overrides?.exemption ?? r.exemption;

    const readingWarning = current < previous;
    const totalConsumption = Math.max(current - previous, 0);
    const regularConsumption = Math.max(totalConsumption - work, 0);
    const estimatedConsumption = overrides?.estimatedConsumption !== undefined
      ? overrides.estimatedConsumption
      : (overrides?.currentReading !== undefined ? 0 : r.estimatedConsumption);

    const effectiveConsumption = estimatedConsumption > 0 ? estimatedConsumption : regularConsumption;

    const calc = calcClient(effectiveConsumption, work, serviceFee, fine, exemption);
    setReadings(prev => ({
      ...prev,
      [billId]: {
        ...prev[billId],
        currentReading: current,
        workUnits: work,
        actualConsumption: totalConsumption,
        estimatedConsumption,
        readingWarning,
        workUnitsTotal: calc.workUnitsTotal,
        consumptionCost: calc.consumptionCost,
        serviceFee,
        fine,
        exemption,
        totalAmount: calc.totalAmount,
      }
    }));
  };

  const handleUnitTypeChange = (billId: string, unitType: UnitType) => {
    setUnitTypes(prev => ({ ...prev, [billId]: unitType }));
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;

    if (unitType === 'regular') {
      const defaultWork = Number(bill.workUnits) || 1;
      recalc(billId, { workUnits: defaultWork });
    } else if (unitType === 'work') {
      const defaultWork = Number(bill.workUnits) || 1;
      recalc(billId, { workUnits: defaultWork });
    } else {
      const defaultWork = Number(bill.workUnits) || 1;
      recalc(billId, { workUnits: defaultWork });
    }
  };

  const handleReadingChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { currentReading: numeric });
  };

  const handleEstimatedConsumptionChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { estimatedConsumption: numeric });
  };

  const handleWorkUnitsChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { workUnits: numeric });
  };

  const handleServiceFeeChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { serviceFee: numeric });
  };

  const handleFineChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { fine: numeric });
  };

  const handleExemptionChange = (billId: string, value: string) => {
    const numeric = parseFloat(value) || 0;
    recalc(billId, { exemption: numeric });
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

  const handleSaveBill = async (billId: string) => {
    if (!activeCycle) return;
    const bill = bills.find(b => b.id === billId);
    if (!bill) return;
    const data = readings[billId];
    if (!data) return;

    try {
      setSavingBillId(billId);
      // Regular consumption for pricing (excludes work units)
      const regularConsumption = Math.max(data.actualConsumption - data.workUnits, 0);
      const entry: any = {
        currentReading: data.currentReading,
        workUnits: data.workUnits,
        consumption: data.estimatedConsumption > 0
          ? data.estimatedConsumption
          : (regularConsumption > 0 ? regularConsumption : 0),
        serviceFee: data.serviceFee,
        fine: data.fine,
        exemption: data.exemption,
        meterPhotoUrl: data.meterPhotoUrl,
        notes: data.notes,
      };
      if (isPendingMode) {
        entry.customerId = (bill as any)._customerId;
      } else {
        entry.billId = billId;
      }

      const res = await fetch(`/api/billing/${activeCycle.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [entry] }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل حفظ الفاتورة");

      alert("تم حفظ الفاتورة بنجاح!");
      fetchCycleBills(activeCycle);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSavingBillId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!activeCycle) return;
    try {
      setSavingReadings(true);
      const entries = Object.entries(readings).map(([id, data]) => {
        const bill = bills.find(b => b.id === id);
        if (!bill) return null;

        const regularConsumption = Math.max(data.actualConsumption - data.workUnits, 0);
        const entry: any = {
          currentReading: data.currentReading,
          workUnits: data.workUnits,
          consumption: data.estimatedConsumption > 0
            ? data.estimatedConsumption
            : (regularConsumption > 0 ? regularConsumption : 0),
          serviceFee: data.serviceFee,
          fine: data.fine,
          exemption: data.exemption,
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
                      <th className="p-2">حساب</th>
                      <th className="p-2">الاسم</th>
                      <th className="p-2">النوع</th>
                      <th className="p-2">القراءة السابقة</th>
                      <th className="p-2">القراءة الحالية</th>
                      <th className="p-2">وحدات العمل</th>
                      <th className="p-2">الاستهلاك الفعلي</th>
                      <th className="p-2">الاستهلاك التقديري</th>
                      <th className="p-2">رسوم الوحدات</th>
                      <th className="p-2">رسوم الخدمات</th>
                      <th className="p-2">الغرامات</th>
                      <th className="p-2">الإعفاءات</th>
                      <th className="p-2">قيمة الاستهلاك</th>
                      <th className="p-2">المتأخرات</th>
                      <th className="p-2">المبلغ الإجمالي</th>
                      <th className="p-2">صورة العداد</th>
                      <th className="p-2">ملاحظات</th>
                      <th className="p-2 text-center">الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {bills.map((b) => {
                      const r = readings[b.id];
                      const ut = unitTypes[b.id] || 'regular';
                      const canEdit = activeCycle.status === 'DRAFT';

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-2 font-bold text-slate-700">{b.customer.accountNumber}</td>
                          <td className="p-2 font-semibold text-slate-800 whitespace-nowrap">{b.customer.name}</td>

                          {/* Type selector */}
                          <td className="p-2">
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
                          <td className="p-2 text-slate-600">
                            {(ut === 'regular' || ut === 'both') ? Number(b.previousReading).toFixed(2) : '—'}
                          </td>

                          {/* Current Reading */}
                          <td className="p-2">
                            {(ut === 'regular' || ut === 'both') ? (
                              <div className="flex items-center space-x-1 space-x-reverse">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  disabled={!canEdit}
                                  value={r?.currentReading ?? Number(b.previousReading)}
                                  onChange={(e) => handleReadingChange(b.id, e.target.value)}
                                  className="w-20 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 no-spinner"
                                />
                                {r?.readingWarning && (
                                  <span className="text-amber-500 text-xs cursor-help" title="القراءة الحالية أقل من القراءة السابقة!">⚠️</span>
                                )}
                              </div>
                            ) : '—'}
                          </td>

                          {/* Work Units */}
                          <td className="p-2">
                            {(ut === 'work' || ut === 'both') ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={!canEdit}
                                value={r?.workUnits ?? 0}
                                onChange={(e) => handleWorkUnitsChange(b.id, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 no-spinner"
                              />
                            ) : '—'}
                          </td>

                          {/* Actual Consumption */}
                          <td className="p-2 text-slate-600 font-bold">
                            {(ut === 'regular' || ut === 'both') ? (r?.actualConsumption ?? 0).toFixed(2) : '—'}
                          </td>

                          {/* Estimated Consumption */}
                          <td className="p-2">
                            {(ut === 'regular' || ut === 'both') ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={!canEdit}
                                value={r?.estimatedConsumption ?? 0}
                                onChange={(e) => handleEstimatedConsumptionChange(b.id, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 no-spinner"
                              />
                            ) : '—'}
                          </td>

                          {/* Work Units Total */}
                          <td className="p-2 text-slate-600">
                            {(ut === 'work' || ut === 'both') ? ((r?.workUnitsTotal ?? 0).toLocaleString() + ' ريال') : '—'}
                          </td>

                          {/* Service Fee */}
                          <td className="p-2">
                            {(ut === 'regular' || ut === 'both') ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                min={0}
                                disabled={!canEdit}
                                value={r?.serviceFee ?? 0}
                                onChange={(e) => handleServiceFeeChange(b.id, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 no-spinner"
                              />
                            ) : '—'}
                          </td>

                          {/* Fine */}
                          <td className="p-2">
                            {(ut === 'regular' || ut === 'both') ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                min={0}
                                disabled={!canEdit}
                                value={r?.fine ?? 0}
                                onChange={(e) => handleFineChange(b.id, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 no-spinner"
                              />
                            ) : '—'}
                          </td>

                          {/* Exemption */}
                          <td className="p-2">
                            {(ut === 'regular' || ut === 'both') ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                min={0}
                                disabled={!canEdit}
                                value={r?.exemption ?? 0}
                                onChange={(e) => handleExemptionChange(b.id, e.target.value)}
                                className="w-16 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 no-spinner"
                              />
                            ) : '—'}
                          </td>

                          {/* Consumption Cost (tiered) */}
                          <td className="p-2 text-slate-600">
                            {(ut === 'regular' || ut === 'both') ? ((r?.consumptionCost ?? 0).toLocaleString() + ' ريال') : '—'}
                          </td>

                          {/* Arrears */}
                          <td className="p-2">
                            <span className="font-bold text-rose-600">
                              {(r?.arrears ?? 0) > 0 ? ((r?.arrears ?? 0).toLocaleString() + ' ريال') : '—'}
                            </span>
                          </td>

                          {/* Total */}
                          <td className="p-2 font-extrabold text-brand-600">
                            {(r?.totalAmount ?? 0).toLocaleString()} ريال
                          </td>

                          {/* Photo */}
                          <td className="p-2">
                            {canEdit ? (
                              <div className="flex items-center space-x-1 space-x-reverse">
                                <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded text-[9px] font-semibold border border-slate-200">
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
                                {uploadingBillId === b.id && <span className="text-[9px] text-slate-400">...</span>}
                                {r?.meterPhotoUrl && (
                                  <a href={r.meterPhotoUrl} target="_blank" className="text-emerald-600 text-[10px]">✔️</a>
                                )}
                              </div>
                            ) : (
                              r?.meterPhotoUrl ? (
                                <a href={r.meterPhotoUrl} target="_blank" className="text-brand-600 hover:underline text-[10px]">عرض</a>
                              ) : "—"
                            )}
                          </td>

                          {/* Notes */}
                          <td className="p-2">
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
                              placeholder="—"
                              className="w-20 border border-slate-200 rounded-lg p-1 text-[10px] focus:outline-none disabled:bg-transparent disabled:border-none"
                            />
                          </td>

                          <td className="p-2 text-center">
                            {activeCycle.status === 'DRAFT' && (
                              <div className="flex items-center justify-center space-x-1 space-x-reverse">
                                <button
                                  onClick={() => handleSaveBill(b.id)}
                                  disabled={savingBillId === b.id}
                                  className="bg-brand-600 hover:bg-brand-700 text-white text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors disabled:opacity-50"
                                >
                                  {savingBillId === b.id ? '...' : '📥 حفظ'}
                                </button>
                                {!b.id.startsWith('pending_') && (
                                  <Link
                                    href={`/print/bill/${b.id}`}
                                    target="_blank"
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-bold border border-slate-200"
                                  >
                                    🖨️ طباعة
                                  </Link>
                                )}
                              </div>
                            )}
                            {activeCycle.status === 'ISSUED' && (
                              <Link
                                href={`/print/bill/${b.id}`}
                                target="_blank"
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-bold border border-slate-200"
                              >
                                🖨️ طباعة
                              </Link>
                            )}
                          </td>
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
