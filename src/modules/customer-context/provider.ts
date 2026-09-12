import type { Customer, Order } from "./domain";

export interface CustomerContextProvider {
  getCustomer(customerId: string): Promise<Customer | null>;
  listOrders(customerId: string): Promise<Order[]>;
}
