import { fireEvent, render } from "@testing-library/react";
import { QueueViewport } from "./queue-viewport";
it("retains the scroll offset when queue rows are refreshed", () => {
  const view = render(<QueueViewport revision="v1"><p>旧会话</p></QueueViewport>);
  const list = view.container.firstElementChild as HTMLDivElement;
  fireEvent.scroll(list, { target: { scrollTop: 240 } });
  view.rerender(<QueueViewport revision="v2"><p>新会话</p><p>旧会话</p></QueueViewport>);
  expect(view.container.firstElementChild).toBe(list);
  expect(list.scrollTop).toBe(240);
});
