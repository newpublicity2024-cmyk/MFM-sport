import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/payload/queries", () => ({
  getPayloadClient: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/youtube-sync", () => ({
  syncVideos: vi.fn().mockResolvedValue({
    created: 1,
    updated: 2,
    pruned: 0,
    perPlaylist: { "the-third-half": 12, "from-the-stadiums": 12 },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { GET } from "@/app/api/cron/sync-videos/route";
import { syncVideos } from "@/lib/youtube-sync";
import { revalidatePath } from "next/cache";

const OLD = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  process.env.YOUTUBE_API_KEY = "yt";
});
afterEach(() => {
  process.env = { ...OLD };
});

function req(auth?: string) {
  return new Request("http://x/api/cron/sync-videos", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/cron/sync-videos", () => {
  it("401s without the correct bearer secret", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(syncVideos).not.toHaveBeenCalled();
  });

  it("401s with a wrong secret", async () => {
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    expect(syncVideos).not.toHaveBeenCalled();
  });

  it("runs the sync and revalidates when authorized", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.created).toBe(1);
    expect(syncVideos).toHaveBeenCalledWith({}, "yt", { prune: true });
    // homepage + /videos for each locale = 6 revalidations
    expect((revalidatePath as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(6);
  });

  it("500s when YOUTUBE_API_KEY is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(500);
    expect(syncVideos).not.toHaveBeenCalled();
  });
});
