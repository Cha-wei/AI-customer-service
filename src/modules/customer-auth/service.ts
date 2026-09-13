import { prisma } from "@/lib/prisma";
import { getCustomerContextProvider } from "@/modules/customer-context/composition-root";
import { validLoginName, verifyPassword } from "./password";

export async function authenticateCustomer(loginName: string, password: string) {
  const account = validLoginName(loginName) ? await prisma.customerAccount.findUnique({ where: { loginName } }) : null;
  const valid = await verifyPassword(password, account?.passwordHash);
  if (!valid || !account?.enabled) return null;
  if (!await getCustomerContextProvider().getCustomer(account.customerId)) return null;
  return { id: account.id, customerId: account.customerId, version: account.sessionVersion };
}
