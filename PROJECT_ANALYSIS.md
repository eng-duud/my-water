# تحليل مشروع my-water

## نظرة عامة

نظام **إدارة فواتير وتحصيل مياه** لمشروع **"غيل الضياء - قدس المواسط"** في اليمن. يتيح إدارة المشتركين، قراءة العدادات، حساب الفواتير، التحصيل المالي، وطباعة الفواتير.

---

## البنية التقنية

| الطبقة | التقنية |
|--------|---------|
| الواجهة | Next.js 15 + React 19 + TypeScript |
| التصميم | Tailwind CSS v4 |
| قاعدة البيانات | Neon PostgreSQL (Serverless) |
| ORM | Prisma 5.10.2 |
| الحسابات المالية | decimal.js (دقة عشرية) |
| التحقق من البيانات | zod |
| رفع الصور | Cloudinary |

---

## هيكل المشروع

```
my-water/
├── .env                         # متغيرات البيئة (محلي)
├── .env.example                 # نموذج متغيرات البيئة
├── .gitignore                   # قواعد تجاهل Git
├── .npmrc                       # إعدادات NPM
├── next.config.ts               # إعدادات Next.js
├── postcss.config.mjs           # إعدادات PostCSS + Tailwind
├── tsconfig.json                # إعدادات TypeScript
├── package.json                 # الحزم والبرمجيات
│
├── prisma/
│   └── schema.prisma            # مخطط قاعدة البيانات (Prisma ORM)
│
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # التخطيط الرئيسي (RTL، عربي)
│   │   ├── page.tsx             # لوحة التحكم الرئيسية
│   │   ├── globals.css          # الأنماط العامة + أنماط الطباعة
│   │   │
│   │   ├── customers/
│   │   │   └── page.tsx         # صفحة إدارة المشتركين
│   │   │
│   │   ├── billing/
│   │   │   └── page.tsx         # صفحة قراءة العدادات والفوترة الجماعية
│   │   │
│   │   ├── payments/
│   │   │   └── page.tsx         # صفحة سداد الفواتير والتحصيل
│   │   │
│   │   ├── print/
│   │   │   ├── bill/[id]/
│   │   │   │   └── page.tsx     # طباعة فاتورة مفردة
│   │   │   └── batch/[cycleId]/
│   │   │       └── page.tsx     # طباعة جماعية للدورة
│   │   │
│   │   └── api/                 # واجهات الخلفية البرمجية (API Routes)
│   │       ├── customers/
│   │       │   ├── route.ts     # GET, POST - المشتركين
│   │       │   └── [id]/
│   │       │       └── route.ts # GET, PUT - مشترك مفرد
│   │       │
│   │       ├── billing/
│   │       │   ├── route.ts     # GET, POST - دورات الفوترة
│   │       │   ├── calculate/
│   │       │   │   └── route.ts # POST - حساب لحظي
│   │       │   ├── [cycleId]/
│   │       │   │   ├── route.ts # GET, PUT - تفاصيل الدورة
│   │       │   │   └── entries/
│   │       │   │       └── route.ts # POST - قراءات جماعية
│   │       │   └── bill/
│   │       │       └── route.ts # GET - جلب فاتورة للطباعة
│   │       │
│   │       ├── payments/
│   │       │   ├── route.ts     # GET, POST - الدفعات
│   │       │   └── [id]/surplus/
│   │       │       └── route.ts # PUT - تسوية الفوائض
│   │       │
│   │       └── dashboard/
│   │           └── route.ts     # GET - إحصائيات لوحة التحكم
│   │
│   └── lib/                     # المكتبات والمنطق الأساسي
│       ├── prisma.ts            # عميل Prisma (نمط Singleton)
│       ├── billing.ts           # محرك حساب الفواتير
│       ├── payment-distribution.ts  # محرك توزيع التحصيل (FIFO)
│       ├── tenant.ts            # إنشاء/جلب المستأجر تلقائياً
│       ├── constants.ts         # الثوابت والأسعار الافتراضية
│       ├── cloudinary.ts        # رفع الصور إلى Cloudinary
│       └── num-to-words.ts      # تحويل الأرقام إلى كلمات عربية
```

---

## الوحدات الرئيسية

| الوحدة | المسار | الوظيفة |
|--------|--------|---------|
| إدارة المشتركين | `src/app/customers/` | إضافة وتعديل المشتركين مع أرقام الحسابات ووحدات العمل وأرقام العدادات |
| قراءة العدادات | `src/app/billing/` | إدخال قراءات العدادات جماعياً لكل دورة فوترة شهرية |
| حساب الفواتير | `src/lib/billing.ts` | محرك حساب تصاعدي يعتمد على الشرائين (Tier-based billing) |
| التحصيل المالي | `src/app/payments/` + `src/lib/payment-distribution.ts` | تسجيل الدفعات وتوزيعها تلقائياً على الفواتير المستحقة بنظام FIFO |
| كشف الفوائض | `src/lib/payment-distribution.ts` | تنبيه وإدارة مبالغ السداد الزائدة |
| طباعة الفواتير | `src/app/print/` | طباعة فاتورة مفردة أو طباعة جماعية لكل دورة |
| لوحة التحكم | `src/app/page.tsx` | مؤشرات KPI (استهلاك، فوترة، تحصيل، ديون متأخرة) مع تحليل 6 دورات |

---

## معادلة الحساب

```
الاستهلاك = القراءة الحالية - القراءة السابقة
رسوم وحدات العمل = عدد الوحدات × 2000 ريال
الشريحة الأولى = min(الاستهلاك، 4) × 700 ريال
الشريحة الثانية = max(الاستهلاك - 4، 0) × 1000 ريال
المبلغ الإجمالي = رسوم وحدات العمل + الشريحة الأولى + الشريحة الثانية
```

**حالة اختبار مؤكدة**: وحدة عمل واحدة، قراءة سابقة 34.4، قراءة حالية 47.1 = **13,500 ريال**

---

## نموذج البيانات

```
Tenant → Customer → Bill
Tenant → BillingCycle → Bill
Tenant → Payment → PaymentAllocation ← Bill
```

### العلاقات بين الجداول:

| العلاقة | الوصف |
|---------|-------|
| Tenant (1) ── (N) Customer | مستأجر واحد، عدة مشتركين |
| Tenant (1) ── (1) TenantSettings | إعدادات المستأجر |
| Tenant (1) ── (N) BillingCycle | دورات فوترة متعددة |
| Tenant (1) ── (N) Payment | دفعات متعددة |
| BillingCycle (1) ── (N) Bill | فواتير متعددة لكل دورة |
| Customer (1) ── (N) Bill | فواتير متعددة لكل مشترك |
| Customer (1) ── (N) Payment | دفعات متعددة لكل مشترك |
| Payment (1) ── (N) PaymentAllocation | جسر توزيع الدفعات |
| Bill (1) ── (N) PaymentAllocation | جسر توزيع الدفعات |

---

## أنماط العمارة

| النمط | الوصف |
|-------|-------|
| **App Router** | فصل واضح بين Server Components و Client Components (`"use client"`) |
| **Repository (Prisma ORM)** | جميع عمليات قاعدة البيانات عبر `prisma.ts` singleton |
| **Multi-Tenancy** | كل جدول يحتوي على `tenantId` - جاهز لـ SaaS |
| **Service Layer** | `billing.ts` و `payment-distribution.ts` كطبقة منطق أعمال |
| **FIFO** | الدفعات تُوزع على الفواتير الأقدم أولاً |
| **Immutability** | `Bill.totalAmount` و مبلغ الدفعة لا يتغيران بعد الإنشاء |
| **Transactions** | استخدام `prisma.$transaction()` للعمليات المتعددة |

---

## إعداد البناء والنشر

| الأمر | الوصف |
|-------|-------|
| `npm run dev` | تشغيل خادم التطوير (`next dev`) |
| `npm run build` | توليد Prisma ثم البناء (`prisma generate && next build`) |
| `npm run start` | تشغيل نسخة الإنتاج (`next start`) |
| `npm run lint` | فحص ESLint (`next lint`) |
| `npm run prisma:migrate` | تطبيق هجرة التطوير |

### نشر Vercel:
```
prisma generate && prisma migrate deploy && next build
```

### قاعدة البيانات:
- **Neon Serverless PostgreSQL** - قاعدة بيانات سحابية مع دعم الاتصال المجمع
- اتصال مزدوج: `DATABASE_URL` (Pooled) للتطبيق، `DIRECT_URL` (Direct) للهجرات

---

## اصطلاحات الكود

| الاصطلاح | الوصف |
|----------|-------|
| **اللغة والاتجاه** | عربية بالكامل، RTL (`dir="rtl"`)، خط IBM Plex Sans Arabic |
| **التحقق من البيانات** | Zod schemas مع رسائل خطأ بالعربية |
| **الأرقام العشرية** | `decimal.js` حصرياً لكل العمليات المالية |
| **أنماط الطباعة** | `@media print` يخفي عناصر التصفح، حجم A4، فاصل صفحات تلقائي |
| **معالجة الأخطاء** | try/catch مع رسائل عربية وتسجيل الأخطاء |

---

## الحالة الراهنة

الإصدار **v0.1.0** - يعمل ويحتاج:

- [ ] نظام مصادقة (غير موجود حالياً)
- [ ] اختبارات آلية رسمية (يوجد اختبار يدوي `scratch_test-calculations.js` فقط)
- [ ] مكونات UI قابلة لإعادة الاستخدام (كل شيء داخل صفحات `page.tsx`)
- [ ] ملف `types/index.ts` للأنواع المشتركة
- [ ] نظام توثيق API (Swagger/OpenAPI)
