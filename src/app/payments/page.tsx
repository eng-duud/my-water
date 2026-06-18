"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Customer {
  id: string;
  accountNumber: string;
  name: string;
}

interface UnpaidBill {
  id: string;
  billNumber: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  createdAt: string;
  billingCycle: {
    year: number;
    month: number;
  };
}

interface Payment {
  id: string;
  amount: string;
  allocatedAmount: string;
  surplusAmount: string;
  surplusHandled: boolean;
  surplusNote: string | null;
  paymentMethod: string | null;
  receiptNumber: string | null;
  notes: string | null;
  createdAt: string;
  customer: {
    name: string;
  };
  allocations: Array<{
    id: string;
    amount: string;
    bill: {
      billNumber: string;
      billingCycle: {
        year: number;
        month: number;
      };
    };
  }>;
}

const ARABIC_MONTHS = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function PaymentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBill[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Surplus handling
  const [selectedPaymentForSurplus, setSelectedPaymentForSurplus] = useState<Payment | null>(null);
  const [surplusNoteInput, setSurplusNoteInput] = useState("");
  const [savingSurplus, setSavingSurplus] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [custRes, payRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/payments"),
      ]);
      if (!custRes.ok || !payRes.ok) throw new Error("فشل تحميل البيانات");
      const custData = await custRes.json();
      const payData = await payRes.json();
      setCustomers(custData.filter((c: any) => c.isActive));
      setPayments(payData);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch unpaid bills when customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setUnpaidBills([]);
      setSelectedBillIds([]);
      return;
    }
    const fetchBills = async () => {
      try {
        const res = await fetch(`/api/customers/${selectedCustomerId}`);
        if (!res.ok) return;
        const data = await res.json();
        const unpaid = (data.bills || [])
          .filter((b: any) => b.status === "PENDING" || b.status === "PARTIALLY_PAID")
          .map((b: any) => ({
            id: b.id,
            billNumber: b.billNumber,
            totalAmount: Number(b.totalAmount),
            paidAmount: Number(b.paidAmount),
            unpaidAmount: Number(b.totalAmount) - Number(b.paidAmount),
            createdAt: b.createdAt,
            billingCycle: b.billingCycle,
          }))
          .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setUnpaidBills(unpaid);
        setSelectedBillIds([]);
      } catch (err) {
        console.error("Error fetching customer bills:", err);
      }
    };
    fetchBills();
  }, [selectedCustomerId]);

  const totalUnpaidSelected = selectedBillIds.reduce((sum, id) => {
    const bill = unpaidBills.find(b => b.id === id);
    return sum + (bill ? bill.unpaidAmount : 0);
  }, 0);
  const enteredAmount = parseFloat(amount) || 0;
  const allocateAmount = Math.min(enteredAmount, totalUnpaidSelected);
  const surplusAmount = Math.max(enteredAmount - totalUnpaidSelected, 0);
  const isOverpayment = enteredAmount > totalUnpaidSelected;

  const toggleBillSelection = (billId: string) => {
    setSelectedBillIds(prev =>
      prev.includes(billId)
        ? prev.filter(id => id !== billId)
        : [...prev, billId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBillIds.length === 0 || !amount) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billIds: selectedBillIds,
          amount: parseFloat(amount),
          paymentMethod,
          receiptNumber: receiptNumber || null,
          notes: notes || null,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "فشل تسجيل الدفعة");

      alert("تم تسجيل الدفعة وتوزيعها على الفواتير المحددة بنجاح!");

      setSelectedCustomerId("");
      setAmount("");
      setReceiptNumber("");
      setNotes("");
      setSelectedBillIds([]);
      fetchData();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveSurplus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForSurplus) return;

    try {
      setSavingSurplus(true);
      const res = await fetch(`/api/payments/${selectedPaymentForSurplus.id}/surplus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surplusHandled: true,
          surplusNote: surplusNoteInput,
        }),
      });
      if (!res.ok) throw new Error("فشل تسوية الرصيد الزائد");

      alert("تم تسجيل تسوية الرصيد المعلق بنجاح!");
      setSelectedPaymentForSurplus(null);
      setSurplusNoteInput("");
      fetchData();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSavingSurplus(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">سداد الفواتير والتحصيل المالي</h2>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">تسجيل المبالغ المقبوضة وتوزيعها على فاتورة أو أكثر.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">➕ تسجيل سند قبض جديد</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">المشترك</label>
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-700"
              >
                <option value="">-- اختر المشترك --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.accountNumber}] - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unpaid bills list with checkboxes */}
            {selectedCustomerId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">اختر الفاتورة/الفواتير المراد سدادها</label>
                {unpaidBills.length === 0 ? (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg">لا يوجد فواتير مستحقة لهذا المشترك.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {unpaidBills.map((b) => (
                      <label
                        key={b.id}
                        className={`flex items-center space-x-2 space-x-reverse p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedBillIds.includes(b.id)
                            ? "border-brand-500 bg-brand-50/50"
                            : "border-slate-100 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBillIds.includes(b.id)}
                          onChange={() => toggleBillSelection(b.id)}
                          className="accent-brand-600 size-4"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-slate-800 block">{b.billNumber}</span>
                          <span className="text-slate-500">
                            {ARABIC_MONTHS[b.billingCycle.month]} {b.billingCycle.year} — 
                            المتبقي: <span className="font-bold text-amber-600">{b.unpaidAmount.toLocaleString()} ريال</span>
                          </span>
                        </div>
                      </label>
                    ))}
                    {selectedBillIds.length > 0 && (
                      <div className="text-[11px] bg-brand-50 text-brand-800 p-2 rounded-lg font-semibold text-center">
                        إجمالي المحدد: {totalUnpaidSelected.toLocaleString()} ريال ({selectedBillIds.length} فاتورة)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">المبلغ المدفوع (ريال يمني)</label>
              <input
                type="number"
                required
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold text-slate-700"
                placeholder="مثال: 5000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-700"
                >
                  <option value="CASH">نقدًا (كاش)</option>
                  <option value="BANK">تحويل بنكي / محفظة</option>
                  <option value="CHECK">شيك</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">رقم السند/المرجع</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="رقم السند الورقي"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">ملاحظات التحصيل</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 h-20 resize-none"
                placeholder="تفاصيل إضافية عن السند..."
              />
            </div>

            {/* Preview */}
            {selectedBillIds.length > 0 && enteredAmount > 0 && (
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700">🔍 معاينة التوزيع:</h4>
                <div className="text-[11px] space-y-1">
                  <div className="text-slate-600">
                    <span className="font-semibold">الفواتير المحددة: </span>
                    <span className="font-bold">{selectedBillIds.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>إجمالي المطلوب:</span>
                    <span className="font-bold text-amber-600">{totalUnpaidSelected.toLocaleString()} ريال</span>
                  </div>
                  <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1">
                    <span>سيتم توزيع:</span>
                    <span className="font-bold text-emerald-600">{allocateAmount.toLocaleString()} ريال</span>
                  </div>
                  {isOverpayment && (
                    <div className="bg-amber-100 text-amber-900 p-2 rounded-lg text-xs font-semibold mt-2">
                      ⚠️ سيتم تسجيل مبلغ <span className="underline">{surplusAmount.toLocaleString()} ريال</span> كرصيد زائد معلق.
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || selectedBillIds.length === 0 || !amount}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "جاري التسجيل والتوزيع..." : "سداد وتسجيل المقبوضات"}
            </button>
          </form>
        </div>

        {/* Right Panel: Payments History */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">📋 سجل المقبوضات والسندات الأخيرة</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="p-3">المشترك</th>
                  <th className="p-3">الفواتير</th>
                  <th className="p-3">دورة الفوترة</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الموزع</th>
                  <th className="p-3">الرصيد المعلق</th>
                  <th className="p-3">حالة الرصيد</th>
                  <th className="p-3 text-center">سند القبض</th>
                  <th className="p-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-slate-400">جاري تحميل سجل السندات...</td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center p-8 text-slate-400">لا يوجد سندات تحصيل مسجلة.</td>
                    </tr>
                  ) : (
                  payments.map((p) => {
                    const billLabels = p.allocations.map(a => a.bill.billNumber).join(", ");
                    const cycleLabels = p.allocations.map(a => `${a.bill.billingCycle.year}/${String(a.bill.billingCycle.month).padStart(2, '0')}`).join(", ");
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-800">{p.customer.name}</td>
                        <td className="p-3 font-mono text-slate-600 text-[10px]">{billLabels || "—"}</td>
                        <td className="p-3 text-slate-600 text-[10px]">{cycleLabels || "—"}</td>
                        <td className="p-3 font-bold text-slate-700">{Number(p.amount).toLocaleString()} ريال</td>
                        <td className="p-3 text-emerald-600 font-semibold">{Number(p.allocatedAmount).toLocaleString()} ريال</td>
                        <td className="p-3 text-amber-600 font-semibold">{Number(p.surplusAmount).toLocaleString()} ريال</td>
                        <td className="p-3">
                          {Number(p.surplusAmount) === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : p.surplusHandled ? (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">تمت التسوية</span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold">معلق</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Link
                            href={`/print/receipt/${p.id}`}
                            target="_blank"
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-1 rounded border border-slate-200"
                          >
                            🖨️ سند
                          </Link>
                        </td>
                        <td className="p-3 text-center">
                          {Number(p.surplusAmount) > 0 && !p.surplusHandled && (
                            <button
                              onClick={() => {
                                setSelectedPaymentForSurplus(p);
                                setSurplusNoteInput(p.surplusNote || "");
                              }}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2 py-1 rounded"
                            >
                              ⚙️ تسوية
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Surplus Resolution Modal */}
      {selectedPaymentForSurplus && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">تسوية رصيد زائد معلق</h3>
              <button onClick={() => setSelectedPaymentForSurplus(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleResolveSurplus} className="space-y-4">
              <div>
                <p className="text-sm text-slate-600">
                  المشترك: <span className="font-bold text-slate-800">{selectedPaymentForSurplus.customer.name}</span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  الرصيد المعلق: <span className="font-bold text-amber-600">{Number(selectedPaymentForSurplus.surplusAmount).toLocaleString()} ريال</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">تفاصيل تسوية الرصيد</label>
                <textarea
                  required
                  value={surplusNoteInput}
                  onChange={(e) => setSurplusNoteInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 h-24 resize-none"
                  placeholder="كيف تم صرف أو تسوية هذا الرصيد؟"
                />
              </div>

              <div className="flex justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedPaymentForSurplus(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingSurplus}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {savingSurplus ? "جاري الحفظ..." : "تأكيد التسوية"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
