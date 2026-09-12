import {
  isCustomerTier,
  isLogisticsStatus,
  isOrderStatus,
} from "./domain";

describe("customer context domain values", () => {
  it("recognizes supported customer tiers", () => {
    expect(isCustomerTier("vip")).toBe(true);
    expect(isCustomerTier("enterprise")).toBe(false);
  });

  it("recognizes supported order and logistics states", () => {
    expect(isOrderStatus("shipped")).toBe(true);
    expect(isOrderStatus("lost")).toBe(false);
    expect(isLogisticsStatus("out_for_delivery")).toBe(true);
    expect(isLogisticsStatus("unknown")).toBe(false);
  });
});
