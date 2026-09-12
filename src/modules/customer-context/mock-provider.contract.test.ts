import { customerContextProviderContract } from "./provider.contract";
import { MockCustomerContextProvider } from "./mock-provider";

describe("MockCustomerContextProvider contract", () => {
  customerContextProviderContract({
    createProvider: () => new MockCustomerContextProvider(),
    existingCustomerId: "customer-1",
    missingCustomerId: "missing-customer",
  });
});
