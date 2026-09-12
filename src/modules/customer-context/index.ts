export type {
  Customer,
  CustomerTier,
  Logistics,
  LogisticsStatus,
  Order,
  OrderItem,
  OrderStatus,
} from "./domain";
export { getCustomerContextProvider } from "./composition-root";
export {
  isCustomerTier,
  isLogisticsStatus,
  isOrderStatus,
} from "./domain";
export { MOCK_CUSTOMERS, MOCK_ORDERS } from "./mock-data";
export { MockCustomerContextProvider } from "./mock-provider";
export type { CustomerContextProvider } from "./provider";
