import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fetchPlaylist, syncVideos, type SyncPayload } from "@/lib/youtube-sync";

// Stub the YouTube HTTP layer. fetchPlaylist makes two calls per feed:
// playlistItems (returns videoIds) then videos (returns details).
function mockYouTube(idsByCall: string[][], detailDuration = "PT8M12S") {
  let call = 0;
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/playlistItems")) {
      const ids = idsByCall[call++] ?? [];
      return {
        ok: true,
        json: async () => ({ items: ids.map((id) => ({ contentDetails: { videoId: id } })) }),
      } as unknown as Response;
    }
    // /videos detail call — echo back details for the ids in the query string.
    const idParam = new URL(u).searchParams.get("id") ?? "";
    const ids = idParam.split(",").filter(Boolean);
    return {
      ok: true,
      json: async () => ({
        items: ids.map((id) => ({
          id,
          snippet: { title: `Title ${id}`, publishedAt: "2026-06-29T00:00:00Z" },
          contentDetails: { duration: detailDuration },
        })),
      }),
    } as unknown as Response;
  });
}

afterEach(() => vi.restoreAllMocks());
beforeEach(() => vi.restoreAllMocks());

describe("fetchPlaylist", () => {
  it("maps playlist items to videos preserving order (index = sortOrder)", async () => {
    vi.stubGlobal("fetch", mockYouTube([["aaa", "bbb"]]));
    const out = await fetchPlaylist("PL1", "key");
    expect(out.map((v) => v.youtubeId)).toEqual(["aaa", "bbb"]);
    expect(out[0].sortOrder).toBe(0);
    expect(out[1].sortOrder).toBe(1);
    expect(out[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/aaa/hqdefault.jpg");
    expect(out[0].duration).toBe("08:12");
  });

  it("returns [] when the playlist has no items", async () => {
    vi.stubGlobal("fetch", mockYouTube([[]]));
    expect(await fetchPlaylist("PL1", "key")).toEqual([]);
  });
});

function fakePayload(existingByPlaylist: Record<string, string[]> = {}): {
  payload: SyncPayload;
  created: string[];
  updated: Array<string | number>;
  deleted: Array<string | number>;
} {
  const created: string[] = [];
  const updated: Array<string | number> = [];
  const deleted: Array<string | number> = [];
  // rows keyed by id; seed "existing" rows so prune/update paths are exercised.
  let nextId = 1000;
  const rows: Array<{ id: number; youtubeId: string; playlist: string }> = [];
  for (const [pl, ids] of Object.entries(existingByPlaylist)) {
    for (const yt of ids) rows.push({ id: nextId++, youtubeId: yt, playlist: pl });
  }
  const payload: SyncPayload = {
    async find(args: any) {
      const where = args.where ?? {};
      if (where.youtubeId?.equals) {
        const hit = rows.find((r) => r.youtubeId === where.youtubeId.equals);
        return { docs: hit ? [hit] : [] };
      }
      if (where.playlist?.equals) {
        return { docs: rows.filter((r) => r.playlist === where.playlist.equals) };
      }
      // No where: the prune pass reads the whole table.
      return { docs: rows.slice() };
    },
    async create(args: any) {
      created.push(args.data.youtubeId);
      rows.push({ id: nextId++, youtubeId: args.data.youtubeId, playlist: args.data.playlist });
      return {};
    },
    async update(args: any) {
      updated.push(args.id);
      return {};
    },
    async delete(args: any) {
      deleted.push(args.id);
      return {};
    },
  };
  return { payload, created, updated, deleted };
}

describe("syncVideos", () => {
  it("asks YouTube for the channel's uploads playlist, never a hand-picked one", async () => {
    const fetchMock = mockYouTube([["new1"]]);
    vi.stubGlobal("fetch", fetchMock);
    await syncVideos(fakePayload().payload, "key");
    const playlistCall = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .find((u) => u.includes("/playlistItems"))!;
    expect(new URL(playlistCall).searchParams.get("playlistId")).toBe("UUnDy06vggD-48O8ePrXMhAw");
  });

  it("creates new videos and reports counts for the feed", async () => {
    vi.stubGlobal("fetch", mockYouTube([["new1", "new2"]]));
    const { payload, created } = fakePayload();
    const res = await syncVideos(payload, "key");
    expect(created).toEqual(["new1", "new2"]);
    expect(res.created).toBe(2);
    expect(res.updated).toBe(0);
    expect(res.perPlaylist).toEqual({ "channel-uploads": 2 });
  });

  it("updates an existing video instead of recreating it", async () => {
    vi.stubGlobal("fetch", mockYouTube([["keep"]]));
    const { payload, created, updated } = fakePayload({ "channel-uploads": ["keep"] });
    const res = await syncVideos(payload, "key");
    expect(created).toEqual([]);
    expect(updated).toEqual([1000]);
    expect(res.updated).toBe(1);
  });

  it("prunes videos no longer in the feed when prune=true", async () => {
    vi.stubGlobal("fetch", mockYouTube([["keep"]]));
    const { payload, deleted } = fakePayload({ "channel-uploads": ["keep", "stale"] });
    await syncVideos(payload, "key", { prune: true });
    // 'keep' stays, 'stale' (row id 1001) is removed.
    expect(deleted).toEqual([1001]);
  });

  it("prune also clears rows left by the retired playlists", async () => {
    vi.stubGlobal("fetch", mockYouTube([["fresh"]]));
    const { payload, deleted } = fakePayload({
      "the-third-half": ["dead1"],
      "from-the-stadiums": ["dead2"],
    });
    const res = await syncVideos(payload, "key", { prune: true });
    expect(deleted).toEqual([1000, 1001]);
    expect(res.pruned).toBe(2);
  });

  it("never prunes when the fetch returned empty (safety)", async () => {
    vi.stubGlobal("fetch", mockYouTube([[]]));
    const { payload, deleted } = fakePayload({ "channel-uploads": ["a", "b"] });
    const res = await syncVideos(payload, "key", { prune: true });
    expect(deleted).toEqual([]);
    expect(res.perPlaylist["channel-uploads"]).toBe(0);
  });
});
