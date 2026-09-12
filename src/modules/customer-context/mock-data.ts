import type { Customer, Order } from "./domain";

export const MOCK_CUSTOMERS: readonly Customer[] = [
  {
    id: "customer-1",
    name: "Alex Chen",
    email: "alex.chen@example.com",
    tier: "premium",
  },
  {
    id: "customer-2",
    name: "Jamie Lin",
    email: "jamie.lin@example.com",
    tier: "standard",
  },
];

export const MOCK_ORDERS: readonly Order[] = [
  {
    id: "order-1001",
    customerId: "customer-1",
    status: "shipped",
    items: [
      { productId: "product-headphones", name: "Wireless Headphones", quantity: 1 },
    ],
    logistics: {
      status: "in_transit",
      carrier: "Mock Express",
      trackingNumber: "MOCK1001",
      estimatedDeliveryAt: new Date("2026-09-15T10:00:00.000Z"),
      updatedAt: new Date("2026-09-12T08:00:00.000Z"),
    },
    createdAt: new Date("2026-09-10T02:00:00.000Z"),
  },
  {
    id: "order-1002",
    customerId: "customer-1",
    status: "delivered",
    items: [{ productId: "product-case", name: "Travel Case", quantity: 1 }],
    logistics: {
      status: "delivered",
      carrier: "Mock Express",
      trackingNumber: "MOCK1002",
      estimatedDeliveryAt: new Date("2026-08-22T10:00:00.000Z"),
      updatedAt: new Date("2026-08-22T09:30:00.000Z"),
    },
    createdAt: new Date("2026-08-18T02:00:00.000Z"),
  },
];
