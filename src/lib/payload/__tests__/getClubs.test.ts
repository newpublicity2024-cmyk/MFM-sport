import { describe, it, expect, vi, beforeEach } from "vitest";

const findMock = vi.fn();

vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({ find: findMock })),
}));
vi.mock("@payload-config", () => ({ default: Promise.resolve({}) }));

import { getClubs } from "@/lib/payload/queries";

describe("getClubs", () => {
  beforeEach(() => {
    findMock.mockReset();
    findMock.mockResolvedValue({ docs: [{ id: "1", name: "Wydad" }] });
  });

  it("queries clubs collection with locale and sort by non-localized slug", async () => {
    await getClubs("en");
    expect(findMock).toHaveBeenCalledWith({
      collection: "clubs",
      locale: "en",
      limit: 50,
      sort: "slug",
      depth: 1,
    });
  });

  it("returns the find() result unchanged", async () => {
    const result = await getClubs("en");
    expect(result.docs[0].name).toBe("Wydad");
  });
});
