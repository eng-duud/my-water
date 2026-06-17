"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardData {
  stats: {
    totalCustomers: number;
    activeCustomers: number;
    totalConsumed: number;
    totalBilled: number;
    totalCollected: number;
    totalDebt: number;
    totalSurplus: number;
  };
  history: Array<{
    id: string;
    name: string;
    year: number;
    month: number;
    status: string;
    billCount: number;
    consumed: number;
    billed: number;
    collected: number;
  }>;
  recentPayments: Array<{
    id: string;
    customerName: string;
    amount: number;
    surplusAmount: number;
    createdAt: string;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewCycleModal, setShowNewCycleModal] = useState(false);
  const [newCycleYear, setNewCycleYear] = useState(new Date().getFullYear());
  const [newCycleMonth, setNewCycleMonth] = useState(new Date().getMonth() + 1);
  const [submittingCycle, setSubmittingCycle] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("فشل في تحميل بيانات لوحة التحكم");
      const d = await res.json();
      setData(d);
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingCycle(true);
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: newCycleYear, month: newCycleMonth }),
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل إنشاء دورة الفوترة");
      }
      setShowNewCycleModal(false);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSubmittingCycle(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">جاري تحميل بيانات لوحة التحكم...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl">
        <h2 className="text-lg font-bold">خطأ في الاتصال</h2>
        <p className="mt-2">{error || "حدث خطأ أثناء تحميل البيانات"}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-600 to-brand-700 p-6 md:p-8 rounded-2xl text-white shadow-lg">
        <div>
          <h2 className="text-2xl font-bold">لوحة التحكم والمؤشرات الرئيسية</h2>
          <p className="text-brand-100 text-sm mt-1">مشروع مياه غيل الضياء - قدس المواسط</p>
        </div>
        <div className="flex space-x-2 space-x-reverse">
          <button 
            onClick={() => setShowNewCycleModal(true)}
            className="bg-white text-brand-700 hover:bg-brand-50 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all"
          >
            ➕ بدء دورة فوترة جديدة
          </button>
        </div>
      </div>

      {/* Main KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500">إجمالي الاستهلاك</span>
            <span className="text-2xl">💧</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-800">
              {data.stats.totalConsumed.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 mt-1">وحدة استهلاك تراكمية</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500">إجمالي المبالغ المفوترة</span>
            <span className="text-2xl">📝</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-800">
              {data.stats.totalBilled.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 mt-1">ريال يمني</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500">إجمالي المبالغ المحصلة</span>
            <span className="text-2xl">🟢</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-emerald-600">
              {data.stats.totalCollected.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 mt-1">ريال يمني</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-sm font-semibold text-slate-500">الديون المستحقة المتأخرة</span>
            <span className="text-2xl">🔴</span>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-rose-600">
              {data.stats.totalDebt.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 mt-1">ريال يمني مستحق</p>
          </div>
        </div>
      </div>

      {/* Alert if there is pending surplus */}
      {data.stats.totalSurplus > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-800">
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold">تنبيه وجود رصيد زائد معلق</p>
              <p className="text-sm mt-0.5">
                يوجد إجمالي رصيد معلق بقيمة <span className="font-bold">{data.stats.totalSurplus.toLocaleString()}</span> ريال يمني لم يتم تخصيصه للفواتير المستقبلية.
              </p>
            </div>
          </div>
          <Link 
            href="/payments"
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold text-xs transition-colors shrink-0"
          >
            عرض وإدارة التحصيلات
          </Link>
        </div>
      )}

      {/* Grid for History Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Billing History Trends */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-slate-800">تحليل الدورات الست الأخيرة</h3>
          
          <div className="space-y-4">
            {data.history.length === 0 ? (
              <p className="text-center text-slate-400 py-8">لا يوجد دورات فوترة مسجلة حتى الآن.</p>
            ) : (
              data.history.map((h) => {
                const collectionRate = h.billed > 0 ? (h.collected / h.billed) * 100 : 0;
                return (
                  <div key={h.id} className="border border-slate-100 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <div className="font-semibold text-slate-700">
                        الدورة: {h.name} 
                        <span className={`mr-2 px-2 py-0.5 rounded text-xs ${
                          h.status === 'ISSUED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          h.status === 'CLOSED' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {h.status === 'ISSUED' ? 'تم الإصدار' : h.status === 'CLOSED' ? 'مغلقة' : 'مسودة'}
                        </span>
                      </div>
                      <div className="text-slate-500 text-xs">
                        {h.billCount} فاتورة | استهلاك {h.consumed.toLocaleString()} وحدة
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                      <div>المفوتر: {h.billed.toLocaleString()} ريال</div>
                      <div className="text-left text-emerald-600">المحصل: {h.collected.toLocaleString()} ريال ({collectionRate.toFixed(1)}%)</div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(collectionRate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent payments activity */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">أحدث عمليات التحصيل</h3>
            <Link href="/payments" className="text-brand-600 hover:text-brand-700 text-xs font-bold">
              عرض الكل ←
            </Link>
          </div>

          <div className="space-y-4">
            {data.recentPayments.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">لم يتم تسجيل أي عمليات دفع بعد.</p>
            ) : (
              data.recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-none last:pb-0">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 text-sm">{payment.customerName}</p>
                    <p className="text-slate-400 text-xs">{new Date(payment.createdAt).toLocaleDateString('ar-YE')}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-emerald-600 text-sm">{payment.amount.toLocaleString()} ريال</p>
                    {payment.surplusAmount > 0 && (
                      <p className="text-amber-600 text-xs">رصيد زائد: {payment.surplusAmount.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Cycle Modal */}
      {showNewCycleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">بدء دورة فوترة جديدة</h3>
              <button 
                onClick={() => setShowNewCycleModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">السنة</label>
                <input 
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  value={newCycleYear}
                  onChange={(e) => setNewCycleYear(parseInt(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">الشهر</label>
                <select
                  required
                  value={newCycleMonth}
                  onChange={(e) => setNewCycleMonth(parseInt(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value={1}>01 - يناير</option>
                  <option value={2}>02 - فبراير</option>
                  <option value={3}>03 - مارس</option>
                  <option value={4}>04 - أبريل</option>
                  <option value={5}>05 - مايو</option>
                  <option value={6}>06 - يونيو</option>
                  <option value={7}>07 - يوليو</option>
                  <option value={8}>08 - أغسطس</option>
                  <option value={9}>09 - سبتمبر</option>
                  <option value={10}>10 - أكتوبر</option>
                  <option value={11}>11 - نوفمبر</option>
                  <option value={12}>12 - ديسمبر</option>
                </select>
              </div>

              <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg leading-relaxed">
                ℹ️ سيتم إنشاء دورة فوترة فارغة. ستتمكن بعد ذلك من إدخال قراءات العدادات يدوياً لكل مشترك في صفحة "قراءة العدادات والفوترة".
              </div>

              <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewCycleModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCycle}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingCycle ? "جاري الإنشاء..." : "إنشاء الدورة"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
