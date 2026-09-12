import type { Customer, Order } from "./domain";
import { MOCK_CUSTOMERS, MOCK_ORDERS } from "./mock-data";
import type { CustomerContextProvider } from "./provider";

export class MockCustomerContextProvider implements CustomerContextProvider {
  constructor(
    private readonly customers: readonly Customer[] = MOCK_CUSTOMERS,
    private readonly orders: readonly Order[] = MOCK_ORDERS,
  ) {}

  async getCustomer(customerId: string): Promise<Customer | null> {
    const customer = this.customers.find((candidate) => candidate.id === customerId);
    return customer ? { ...customer } : null;
  }

  async listOrders(customerId: string): Promise<Order[]> {
    return this.orders
      .filter((order) => order.customerId === customerId)
      .map(cloneOrder);
  }
}

function cloneOrder(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    logistics: { ...order.logistics },
  };
}
