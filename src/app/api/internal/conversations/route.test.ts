import { POST } from "./route";
import { configureTestAuth, authHeaders } from "@/test/internal-auth";
configureTestAuth();

describe("POST /api/internal/conversations", () => {
  it("returns a structured validation error for invalid JSON", async () => {
    const request = new Request("http://localhost/api/internal/conversations", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders },
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "validation_error",
        message: "Request body must be valid JSON.",
      },
    });
  });
});
