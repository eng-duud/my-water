const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const bills = await p.bill.findMany({
    where: { tenantId: 'ghayl-al-diya' },
    select: { id: true, currentReading: true, consumption: true, workUnits: true, previousReading: true, billingCycleId: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  for (const b of bills) {
    console.log(`bill: prev=${b.previousReading} curr=${b.currentReading} cons=${b.consumption} work=${b.workUnits} cycle=${b.billingCycleId.slice(0,8)}`);
  }
  await p.$disconnect();
})();
