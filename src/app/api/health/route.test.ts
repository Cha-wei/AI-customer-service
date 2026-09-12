import { GET, HEALTH_RESPONSE } from "./route";

describe("GET /api/health", () => {
  it("returns the stable service health payload", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(HEALTH_RESPONSE);
  });
});
