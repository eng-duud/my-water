import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getOrCreateTenant } from '@/lib/tenant';
import { TENANT_ID } from '@/lib/constants';

const createCustomerSchema = z.object({
  accountNumber: z.string().min(1, 'رقم الحساب مطلوب'),
  name: z.string().min(1, 'اسم العميل مطلوب'),
  phone: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  workUnits: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
  meterNumber: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await getOrCreateTenant(TENANT_ID);
    const customers = await prisma.customer.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { accountNumber: 'asc' },
    });
    return NextResponse.json(customers);
  } catch (error: any) {
    console.error('Fetch customers error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب العملاء' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await getOrCreateTenant(TENANT_ID);
    const body = await request.json();
    const parsed = createCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.format() },
        { status: 400 }
      );
    }

    // Check duplicate account number
    const existing = await prisma.customer.findUnique({
      where: {
        tenantId_accountNumber: {
          tenantId: TENANT_ID,
          accountNumber: parsed.data.accountNumber,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'رقم الحساب هذا مسجل مسبقاً لعميل آخر' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        ...parsed.data,
        tenantId: TENANT_ID,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error('Create customer error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة العميل' }, { status: 500 });
  }
}
