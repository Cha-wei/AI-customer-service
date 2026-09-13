import { PrismaClient } from '@prisma/client';
import { hashPassword, validLoginName } from '../src/modules/customer-auth/password.ts';
import { MOCK_CUSTOMERS } from '../src/modules/customer-context/mock-data.ts';

try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const [command, rawName, customerId, ...extra] = process.argv.slice(2);
const loginName = rawName?.trim().toLowerCase();
if (!loginName || !validLoginName(loginName) || extra.length || !['create', 'reset-password', 'disable', 'enable'].includes(command) || (command !== 'create' && customerId)) {
  console.error('Usage: pnpm customer:account create <login-name> <customer-id> | reset-password/disable/enable <login-name>');
  process.exit(1);
}
const prisma = new PrismaClient();
try {
  if (command === 'create') {
    // Current Customer Context is Mock; keep provisioning aligned with its actual IDs.
    if (!MOCK_CUSTOMERS.some(customer => customer.id === customerId)) throw new Error('Unknown customer mapping.');
    const passwordHash = await hashPassword(process.env.CUSTOMER_ACCOUNT_PASSWORD ?? '');
    await prisma.customerAccount.create({ data: { loginName, customerId, passwordHash } });
  } else if (command === 'reset-password') {
    const passwordHash = await hashPassword(process.env.CUSTOMER_ACCOUNT_PASSWORD ?? '');
    await prisma.customerAccount.update({ where: { loginName }, data: { passwordHash, sessionVersion: { increment: 1 } } });
  } else {
    await prisma.customerAccount.update({ where: { loginName }, data: { enabled: command === 'enable', sessionVersion: { increment: 1 } } });
  }
  console.log('Customer account updated. No credentials were printed.');
} catch {
  console.error('Account operation failed. Check migration, unique login/customer mapping, account existence and a 12–128 character CUSTOMER_ACCOUNT_PASSWORD for create/reset-password.');
  process.exitCode = 1;
} finally { delete process.env.CUSTOMER_ACCOUNT_PASSWORD; await prisma.$disconnect(); }
