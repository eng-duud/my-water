"use client";

import { useEffect, useState } from "react";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface Customer {
  id: string;
  accountNumber: string;
  name: string;
  phone: string | null;
  village: string | null;
  workUnits: number | string;
  initialReading: number | string;
  isActive: boolean;
  meterNumber: string | null;
  photoUrl: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [workUnits] = useState("0");
  const [initialReading, setInitialReading] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [meterNumber, setMeterNumber] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("فشل جلب المشتركين");
      const data = await res.json();
      setCustomers(data);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openAddModal = () => {
    setCustomerId(null);
    setAccountNumber("");
    setName("");
    setPhone("");
    setVillage("");
    setInitialReading("0");
    setIsActive(true);
    setMeterNumber("");
    setPhotoUrl("");
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setCustomerId(c.id);
    setAccountNumber(c.accountNumber);
    setName(c.name);
    setPhone(c.phone || "");
    setVillage(c.village || "");
    setInitialReading(String(Number(c.initialReading)));
    setIsActive(c.isActive);
    setMeterNumber(c.meterNumber || "");
    setPhotoUrl(c.photoUrl || "");
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const url = await uploadToCloudinary(file);
      setPhotoUrl(url);
    } catch (err: any) {
      alert(err.message || "فشل تحميل الصورة إلى السحابة");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const url = customerId ? `/api/customers/${customerId}` : "/api/customers";
      const method = customerId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber,
          name,
          phone: phone || null,
          village: village || null,
          workUnits: 0,
          initialReading: parseFloat(initialReading) || 0,
          isActive,
          meterNumber: meterNumber || null,
          photoUrl: photoUrl || null,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "فشل حفظ بيانات المشترك");
      }

      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.accountNumber.includes(searchQuery) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.village && c.village.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">إدارة المشتركين</h2>
          <p className="text-xs text-slate-500 mt-0.5">تسجيل وتعديل بيانات المشتركين وتحديد حالة الحساب.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-colors shrink-0"
        >
          + إضافة مشترك جديد
        </button>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
        <span className="text-slate-400 ml-2">🔍</span>
        <input
          type="text"
          placeholder="ابحث باسم المشترك، رقم الحساب، الهاتف، أو القرية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-sm focus:outline-none focus:ring-0 placeholder:text-slate-400"
        />
      </div>

      {/* Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">جاري تحميل قائمة المشتركين...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">لا يوجد مشتركين مطابقين للبحث.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="p-4">رقم الحساب</th>
                  <th className="p-4">الاسم</th>
                  <th className="p-4">الهاتف</th>
                  <th className="p-4">القرية</th>
                  <th className="p-4">وحدات العمل</th>
                  <th className="p-4">رقم العداد</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700">{c.accountNumber}</td>
                    <td className="p-4">
                      <div className="flex items-center space-x-3 space-x-reverse">
                        {c.photoUrl ? (
                          <img
                            src={c.photoUrl}
                            alt={c.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                            {c.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-semibold text-slate-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">{c.phone || "—"}</td>
                    <td className="p-4 text-slate-600">{c.village || "—"}</td>
                    <td className="p-4 text-slate-600 font-mono">{Number(c.workUnits)}</td>
                    <td className="p-4 text-slate-600">{c.meterNumber || "—"}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          c.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}
                      >
                        {c.isActive ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    <td className="p-4 text-center space-x-1 space-x-reverse">
                      <button
                        onClick={() => openEditModal(c)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        تعديل
                      </button>
                      <a
                        href={`/print/statement/${c.id}`}
                        target="_blank"
                        className="inline-block bg-sky-100 hover:bg-sky-200 text-sky-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        كشف حساب
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">
                {customerId ? "تعديل بيانات المشترك" : "إضافة مشترك جديد"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">رقم الحساب (فريد)</label>
                  <input
                    type="text"
                    required
                    disabled={!!customerId}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                    placeholder="مثال: 1001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المشترك</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="الاسم الرباعي للمشترك"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="777xxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">القرية</label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="مثال: قدس المواسط"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">القراءة الابتدائية</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={initialReading}
                    onChange={(e) => setInitialReading(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="مثال: 0 أو 100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">رقم العداد</label>
                  <input
                    type="text"
                    required
                    value={meterNumber}
                    onChange={(e) => setMeterNumber(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="رقم العداد المطبوع"
                  />
                </div>
              </div>

              {/* Account Status Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">حالة الحساب</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsActive(true)}
                    className={`flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                      isActive
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                    <span>نشط</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsActive(false)}
                    className={`flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                      !isActive
                        ? 'bg-rose-50 border-rose-300 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${!isActive ? 'bg-rose-500' : 'bg-slate-200'}`} />
                    <span>غير نشط</span>
                  </button>
                </div>
              </div>

              {/* Cloudinary Image Upload */}
              <div className="border border-dashed border-slate-200 p-4 rounded-xl space-y-3">
                <label className="block text-xs font-semibold text-slate-600">صورة العداد أو الهوية (اختياري)</label>
                <div className="flex items-center space-x-4 space-x-reverse">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs text-slate-500 file:ml-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                  />
                  {uploadingImage && <div className="text-xs text-slate-400">جاري الرفع...</div>}
                </div>
                {photoUrl && (
                  <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                    <img src={photoUrl} alt="Uploaded" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl("")}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 space-x-reverse pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  {submitting ? "جاري الحفظ..." : "حفظ المشترك"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
