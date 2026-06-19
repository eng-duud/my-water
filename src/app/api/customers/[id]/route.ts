import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';

const updateCustomerSchema = z.object({
  name: z.string().min(1, 'اسم العميل مطلوب'),
  phone: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  workUnits: z.number().min(0).optional(),
  isActive: z.boolean(),
  meterNumber: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

type ContextType = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: ContextType
) {
  try {
    const { id } = await context.params;
    const customer = await prisma.customer.findFirst({
      where: {
        id,
        tenantId: TENANT_ID,
      },
      include: {
        bills: {
          include: {
            billingCycle: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Fetch customer error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب تفاصيل العميل' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: ContextType
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        tenantId: TENANT_ID,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Update customer error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث بيانات العميل' }, { status: 500 });
  }
}
