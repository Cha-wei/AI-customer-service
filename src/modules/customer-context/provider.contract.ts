import type { CustomerContextProvider } from "./provider";

export interface CustomerContextProviderContractFixture {
  createProvider(): CustomerContextProvider;
  existingCustomerId: string;
  missingCustomerId: string;
}

export function customerContextProviderContract(
  fixture: CustomerContextProviderContractFixture,
): void {
  it("returns a customer by id", async () => {
    const customer = await fixture
      .createProvider()
      .getCustomer(fixture.existingCustomerId);

    expect(customer?.id).toBe(fixture.existingCustomerId);
  });

  it("returns null for a missing customer", async () => {
    await expect(
      fixture.createProvider().getCustomer(fixture.missingCustomerId),
    ).resolves.toBeNull();
  });

  it("only returns orders belonging to the requested customer", async () => {
    const orders = await fixture
      .createProvider()
      .listOrders(fixture.existingCustomerId);

    expect(orders.length).toBeGreaterThan(0);
    expect(
      orders.every((order) => order.customerId === fixture.existingCustomerId),
    ).toBe(true);
  });

  it("returns an empty order list for an unknown customer", async () => {
    await expect(
      fixture.createProvider().listOrders(fixture.missingCustomerId),
    ).resolves.toEqual([]);
  });
}
