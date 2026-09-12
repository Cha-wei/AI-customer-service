export const CUSTOMER_TIERS = ["standard", "premium", "vip"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const ORDER_STATUSES = [
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const LOGISTICS_STATUSES = [
  "not_shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
] as const;
export type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];

export interface Customer {
  id: string;
  name: string;
  email: string;
  tier: CustomerTier;
}

export interface Logistics {
  status: LogisticsStatus;
  carrier: string | null;
  trackingNumber: string | null;
  estimatedDeliveryAt: Date | null;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  items: OrderItem[];
  logistics: Logistics;
  createdAt: Date;
}

export function isCustomerTier(value: string): value is CustomerTier {
  return CUSTOMER_TIERS.includes(value as CustomerTier);
}

export function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus);
}

export function isLogisticsStatus(value: string): value is LogisticsStatus {
  return LOGISTICS_STATUSES.includes(value as LogisticsStatus);
}
