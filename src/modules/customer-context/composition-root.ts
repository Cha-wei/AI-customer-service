import { MockCustomerContextProvider } from "./mock-provider";
import type { CustomerContextProvider } from "./provider";

let customerContextProvider: CustomerContextProvider | undefined;

export function getCustomerContextProvider(): CustomerContextProvider {
  if (!customerContextProvider) {
    customerContextProvider = new MockCustomerContextProvider();
  }

  return customerContextProvider;
}
