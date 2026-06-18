import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { allocatePaymentToSingleBill } from '@/lib/payment-distribution';
import { TENANT_ID } from '@/lib/constants';

const paymentSchema = z.object({
  billIds: z.array(z.string().min(1)).min(1, 'يجب اختيار فاتورة واحدة على الأقل'),
  amount: z.number().positive('مبلغ السداد يجب أن يكون أكبر من الصفر'),
  paymentMethod: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const payments = await prisma.payment.findMany({
      where: { tenantId: TENANT_ID },
      include: {
        customer: true,
        allocations: {
          include: {
            bill: {
              include: {
                billingCycle: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(payments);
  } catch (error: any) {
    console.error('Fetch payments error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الدفعات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both billIds (array) and billId (single, backward compatibility)
    if (body.billId && !body.billIds) {
      body.billIds = [body.billId];
    }
    const parsed = paymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صالحة', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const result = await allocatePaymentToSingleBill({
      tenantId: TENANT_ID,
      billIds: parsed.data.billIds,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      receiptNumber: parsed.data.receiptNumber,
      notes: parsed.data.notes,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error('Record payment error:', error);
    return NextResponse.json({ error: error.message || 'حدث خطأ أثناء تسجيل الدفعة' }, { status: 500 });
  }
}
