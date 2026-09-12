import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home", () => {
  it("shows that the MVP foundation is ready", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "AI Customer Service Workbench" }),
    ).toBeInTheDocument();
    expect(screen.getByText("基础骨架已就绪")).toBeInTheDocument();
  });
});
