import { getCustomerContextProvider } from "../customer-context";
import { OrderQueryTool } from "./order-query-tool";

let orderQueryTool: OrderQueryTool | undefined;

export function getOrderQueryTool(): OrderQueryTool {
  if (!orderQueryTool) {
    orderQueryTool = new OrderQueryTool(getCustomerContextProvider());
  }

  return orderQueryTool;
}
