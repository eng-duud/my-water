const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const cs = await p.customer.findMany({
    where: { tenantId: 'ghayl-al-diya' },
    select: { id: true, name: true },
    take: 5
  });
  cs.forEach(c => console.log(c.id, c.name));
  await p.$disconnect();
})();
