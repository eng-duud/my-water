import Decimal from 'decimal.js';
import prisma from './prisma';

interface PaymentInput {
  tenantId: string;
  billId: string;
  amount: number | string | Decimal;
  paymentMethod?: string | null;
  receiptNumber?: string | null;
  notes?: string | null;
}

export async function allocatePaymentToSingleBill(input: PaymentInput) {
  const amountDecimal = new Decimal(input.amount);
  if (amountDecimal.lessThanOrEqualTo(0)) {
    throw new Error('يجب أن يكون مبلغ السداد أكبر من الصفر.');
  }

  return await prisma.$transaction(async (tx: any) => {
    const bill = await tx.bill.findUnique({
      where: { id: input.billId },
      include: { customer: true },
    });

    if (!bill) {
      throw new Error('الفاتورة غير موجودة');
    }

    const totalAmount = new Decimal(bill.totalAmount);
    const currentPaid = new Decimal(bill.paidAmount);
    const unpaidAmount = Decimal.max(totalAmount.minus(currentPaid), new Decimal(0));

    if (unpaidAmount.lessThanOrEqualTo(0)) {
      throw new Error('هذه الفاتورة مسددة بالكامل بالفعل');
    }

    const allocateAmount = Decimal.min(amountDecimal, unpaidAmount);
    const newPaidAmount = currentPaid.plus(allocateAmount);
    const newStatus = newPaidAmount.greaterThanOrEqualTo(totalAmount) ? 'PAID' : 'PARTIALLY_PAID';

    await tx.bill.update({
      where: { id: input.billId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
      },
    });

    const payment = await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        customerId: bill.customerId,
        amount: amountDecimal,
        allocatedAmount: allocateAmount,
        surplusAmount: Decimal.max(amountDecimal.minus(allocateAmount), new Decimal(0)),
        surplusHandled: allocateAmount.greaterThanOrEqualTo(amountDecimal),
        paymentMethod: input.paymentMethod || null,
        receiptNumber: input.receiptNumber || null,
        notes: input.notes || null,
      },
    });

    await tx.paymentAllocation.create({
      data: {
        tenantId: input.tenantId,
        paymentId: payment.id,
        billId: input.billId,
        amount: allocateAmount,
      },
    });

    return {
      paymentId: payment.id,
      customerName: bill.customer.name,
      billNumber: bill.billNumber,
      amount: amountDecimal.toNumber(),
      allocatedAmount: allocateAmount.toNumber(),
      surplusAmount: Math.max(amountDecimal.toNumber() - allocateAmount.toNumber(), 0),
    };
  });
}
