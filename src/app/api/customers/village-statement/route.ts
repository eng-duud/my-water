import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { TENANT_ID } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const village = searchParams.get('village');

    if (!village) {
      return NextResponse.json({ error: 'اسم القرية مطلوب' }, { status: 400 });
    }

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: TENANT_ID,
        village: village,
      },
      include: {
        bills: {
          select: {
            totalAmount: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
      orderBy: {
        accountNumber: 'asc',
      },
    });

    const customersSummary = customers.map((c) => {
      const totalBilled = c.bills.reduce((sum, b) => sum + Number(b.totalAmount), 0);
      const totalPaid = c.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const currentBalance = totalBilled - totalPaid;

      return {
        id: c.id,
        accountNumber: c.accountNumber,
        name: c.name,
        phone: c.phone,
        village: c.village,
        meterNumber: c.meterNumber,
        isActive: c.isActive,
        totalBilled,
        totalPaid,
        currentBalance,
      };
    });

    const totalBilled = customersSummary.reduce((sum, c) => sum + c.totalBilled, 0);
    const totalPaid = customersSummary.reduce((sum, c) => sum + c.totalPaid, 0);
    const currentBalance = totalBilled - totalPaid;

    return NextResponse.json({
      village,
      customers: customersSummary,
      summary: {
        totalBilled,
        totalPaid,
        currentBalance,
        customersCount: customers.length,
      },
    });
  } catch (error: any) {
    console.error('Fetch village statement error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب كشف الحساب الموحد للقرية' }, { status: 500 });
  }
}
