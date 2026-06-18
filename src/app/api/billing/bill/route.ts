import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف الفاتورة مطلوب' }, { status: 400 });
    }

    const bill = await prisma.bill.findFirst({
      where: {
        id,
        tenantId: TENANT_ID,
      },
      include: {
        customer: true,
        billingCycle: true,
      },
    });

    if (!bill) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 });
    }

    // Fetch ALL previous unpaid bills for arrears calculation
    const previousBills = await prisma.bill.findMany({
      where: {
        customerId: bill.customerId,
        tenantId: TENANT_ID,
        createdAt: { lt: bill.createdAt },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Sum of arrears = total amounts - paid amounts across ALL previous bills
    let totalArrears = 0;
    for (const pb of previousBills) {
      const unpaid = Number(pb.totalAmount) - Number(pb.paidAmount);
      if (unpaid > 0) totalArrears += unpaid;
    }

    return NextResponse.json({
      ...bill,
      previousBillAmount: previousBills.length > 0 ? previousBills.reduce((sum, pb) => sum + Number(pb.totalAmount), 0) : 0,
      previousBillPaid: previousBills.length > 0 ? previousBills.reduce((sum, pb) => sum + Number(pb.paidAmount), 0) : 0,
      arrears: totalArrears,
    });
  } catch (error: any) {
    console.error('Fetch print bill error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب الفاتورة' }, { status: 500 });
  }
}
