import { describe, it, expect } from "vitest";
import { parseEmbed } from "./parseEmbed";

// --- Real-platform fixtures used below -------------------------------------
//
// X (Twitter) fixtures are genuinely fetched, unmodified `html` field values
// from the public, unauthenticated oEmbed endpoint:
//   https://publish.twitter.com/oembed?url=<tweet-url>  (redirects to publish.x.com)
// fetched 2026-07-29. Nothing in these strings has been edited by hand.
//
// JACK_TWEET_HTML — https://x.com/jack/status/20 ("just setting up my twttr",
// the first tweet ever posted, March 2006). A plain, non-quote tweet.
//
// OPTAJOE_QUOTE_TWEET_HTML and QUOTED_TWEET_HTML together document a genuine
// quote-tweet pair: OptaJoe's tweet (id 2082433501937242268) quotes David
// Ornstein's tweet (id 2082208184354161074). The quote relationship was
// confirmed independently via the (separate, also public) syndication API —
// https://cdn.syndication.twimg.com/tweet-result — whose JSON for OptaJoe's
// tweet carries "quoted_status_id_str":"2082208184354161074". That confirms
// this really is a quote-tweet pair, which matters because of what it reveals
// about the oEmbed HTML itself: X's oEmbed API never expands the quoted
// tweet's link in the static `html` it returns — it renders as a `t.co`
// short link (`https://t.co/Zxz44kmJwO` in OPTAJOE_QUOTE_TWEET_HTML below),
// never as `https://x.com/.../status/...`. The full quoted-tweet card only
// appears client-side once `widgets.js` runs a second network request in a
// real browser, which a static fetch of the oEmbed endpoint never triggers.
// So no single genuine oEmbed fetch — quote-tweet or not — ever contains two
// distinct resolvable status URLs on its own.
//
// To still exercise the decoy scenario B1 describes ("a quoted tweet carries
// two different status URLs") using only genuine platform bytes, the
// "quoted tweet" test below concatenates two independently and genuinely
// fetched blockquotes: the quoting tweet's and the quoted tweet's. Every
// character in both strings is real, unedited oEmbed output; only the
// concatenation (pasting both embed snippets into one block) is mine, and it
// mirrors a realistic authoring scenario — a journalist or CMS assembling a
// "quote tweet" by embedding both posts together, since that is the only way
// to reproduce a real quoted-tweet's own visual, on the current platform,
// without the widgets.js runtime this parser deliberately never loads.
const JACK_TWEET_HTML =
  '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20?ref_src=twsrc%5Etfw">March 21, 2006</a></blockquote>\n<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>';

const OPTAJOE_QUOTE_TWEET_HTML =
  '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">400 - Chelsea haven&#39;t had a player with 400+ Premier League appearances appear for them in the competition since John Terry&#39;s 492nd and final appearance in May 2017.<br><br>Guard. <a href="https://t.co/Zxz44kmJwO">https://t.co/Zxz44kmJwO</a> <a href="https://t.co/1sYEijfsWv">pic.twitter.com/1sYEijfsWv</a></p>&mdash; OptaJoe (@OptaJoe) <a href="https://x.com/OptaJoe/status/2082433501937242268?ref_src=twsrc%5Etfw">July 29, 2026</a></blockquote>\n<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>';

const QUOTED_TWEET_HTML =
  '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">🚨 Chelsea in process of finalising deal to sign Danny Welbeck from Brighton &amp; Hove Albion. Permission granted by <a href="https://x.com/hashtag/BHAFC?src=hash&amp;ref_src=twsrc%5Etfw">#BHAFC</a> for medical; if all goes to plan 35yo to do it by end of week &amp; join <a href="https://x.com/hashtag/CFC?src=hash&amp;ref_src=twsrc%5Etfw">#CFC</a> in Hong Kong. 2yr contract agreed in principle <a href="https://x.com/TheAthleticFC?ref_src=twsrc%5Etfw">@TheAthleticFC</a> <a href="https://t.co/1h5bGFie4U">https://t.co/1h5bGFie4U</a></p>&mdash; David Ornstein (@David_Ornstein) <a href="https://x.com/David_Ornstein/status/2082208184354161074?ref_src=twsrc%5Etfw">July 28, 2026</a></blockquote>\n<script async src="https://platform.x.com/widgets.js" charset="utf-8"></script>';

// INSTAGRAM_BLOCKQUOTE_HTML is DOCUMENTED-FORMAT, NOT fetched. Instagram's
// oEmbed now requires a Meta app access token (confirmed: both
// graph.facebook.com/.../instagram_oembed and the legacy api.instagram.com/
// oembed redirect returned an auth wall, not JSON, when tried unauthenticated
// on 2026-07-29). This reproduces the shape Instagram's own documentation and
// embed.js have published for years: a `data-instgrm-permalink` attribute,
// the same permalink repeated as the caption link, and a profile link in the
// "A post shared by" byline.
const INSTAGRAM_BLOCKQUOTE_HTML =
  '<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="https://www.instagram.com/p/C1a2B3c4D5e/?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14"><div><a href="https://www.instagram.com/p/C1a2B3c4D5e/?utm_source=ig_embed&amp;utm_campaign=loading" target="_blank">View this post on Instagram</a><p>A post shared by MFM Sport (<a href="https://www.instagram.com/mfmsport/" target="_blank">@mfmsport</a>)</p></div></blockquote>\n<script async src="//www.instagram.com/embed.js"></script>';

describe("parseEmbed — empty and non-content input", () => {
  it.each([undefined, null, "", "   "])("returns { ok: false, reason: 'empty' } for %j", (input) => {
    expect(parseEmbed(input)).toEqual({ ok: false, reason: "empty" });
  });

  it("returns { ok: false, reason: 'unsupported' } for text with no platform in it", () => {
    expect(parseEmbed("not a link at all")).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("parseEmbed — non-string input never throws (B2)", () => {
  it.each<[string, unknown]>([
    ["an array", ["https://x.com/a/status/1"]],
    ["a plain object", { url: "https://x.com/a/status/1" }],
    ["a number", 12345],
    ["a boolean", true],
    ["a Symbol", Symbol("embed")],
  ])("returns { ok: false, reason: 'empty' } for %s, without throwing", (_label, input) => {
    expect(() => parseEmbed(input)).not.toThrow();
    expect(parseEmbed(input)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("parseEmbed — YouTube resolves to a canonical watch URL", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
  ])("maps %s to the canonical watch URL", (url) => {
    expect(parseEmbed(url)).toEqual({
      ok: true,
      embed: {
        platform: "youtube",
        id: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
  });

  it("strips tracking params from the canonical URL", () => {
    const result = parseEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=xyz");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "youtube",
        id: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
  });
});

describe("parseEmbed — Instagram preserves the matched content type", () => {
  it("resolves a /p/ post URL", () => {
    const result = parseEmbed("https://www.instagram.com/p/C1a2B3c4D5e/");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "instagram",
        id: "C1a2B3c4D5e",
        canonicalUrl: "https://www.instagram.com/p/C1a2B3c4D5e/",
      },
    });
  });

  it("keeps /reel/ distinct from /p/ — the types are not interchangeable", () => {
    const result = parseEmbed("https://www.instagram.com/reel/C1a2B3c4D5e/");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "instagram",
        id: "C1a2B3c4D5e",
        canonicalUrl: "https://www.instagram.com/reel/C1a2B3c4D5e/",
      },
    });
  });

  it("resolves m.instagram.com (mobile subdomain, previously missing from the allowlist)", () => {
    const result = parseEmbed("https://m.instagram.com/p/C1a2B3c4D5e/");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "instagram",
        id: "C1a2B3c4D5e",
        canonicalUrl: "https://www.instagram.com/p/C1a2B3c4D5e/",
      },
    });
  });

  it("keeps /tv/ distinct as well — all three of p, reel and tv are matched, not normalised", () => {
    const result = parseEmbed("https://www.instagram.com/tv/C1a2B3c4D5e/");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "instagram",
        id: "C1a2B3c4D5e",
        canonicalUrl: "https://www.instagram.com/tv/C1a2B3c4D5e/",
      },
    });
  });
});

describe("parseEmbed — X (formerly Twitter)", () => {
  it.each([
    "https://twitter.com/MFMSport/status/1234567890123456789",
    "https://x.com/MFMSport/status/1234567890123456789",
  ])("resolves %s to platform x with an x.com canonical URL", (url) => {
    expect(parseEmbed(url)).toEqual({
      ok: true,
      embed: {
        platform: "x",
        id: "1234567890123456789",
        canonicalUrl: "https://x.com/MFMSport/status/1234567890123456789",
      },
    });
  });

  it("accepts underscores in the handle (real Twitter/X handle format)", () => {
    const result = parseEmbed("https://x.com/MFM_Sport/status/123");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "x",
        id: "123",
        canonicalUrl: "https://x.com/MFM_Sport/status/123",
      },
    });
  });
});

describe("parseEmbed — Facebook keeps the whole URL as its id", () => {
  it("resolves a post URL", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/posts/123456789");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://www.facebook.com/MFMSport/posts/123456789",
        canonicalUrl: "https://www.facebook.com/MFMSport/posts/123456789",
      },
    });
  });

  it("resolves a video URL the same way — post vs. video plugin choice is a rendering concern, not a parsing one", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/videos/123456789");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://www.facebook.com/MFMSport/videos/123456789",
        canonicalUrl: "https://www.facebook.com/MFMSport/videos/123456789",
      },
    });
  });

  it("accepts m.facebook.com (mobile subdomain in allowlist)", () => {
    const result = parseEmbed("https://m.facebook.com/MFMSport/posts/123");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://m.facebook.com/MFMSport/posts/123",
        canonicalUrl: "https://m.facebook.com/MFMSport/posts/123",
      },
    });
  });

  it("strips the query string and fragment from the canonical URL", () => {
    const result = parseEmbed("https://www.facebook.com/MFMSport/posts/123456789?ref=share#comment-1");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://www.facebook.com/MFMSport/posts/123456789",
        canonicalUrl: "https://www.facebook.com/MFMSport/posts/123456789",
      },
    });
  });
});

// Fix round 1, Finding 2: /watch/?v=<id> is Facebook's own video-share form (its
// mobile "Share" sheet produces exactly this), and the video id lives ONLY in
// the `v` query param. The general "strip the query string" rule above would
// silently resolve every /watch link to https://www.facebook.com/watch/ --
// Facebook's Watch HOMEPAGE, not the video that was shared. This is the one
// deliberate exception to that rule: /watch keeps `v` and drops everything else.
describe("parseEmbed — facebook.com/watch preserves the v= video id", () => {
  it("keeps exactly ?v=<id> for /watch/?v=<id>", () => {
    const result = parseEmbed("https://www.facebook.com/watch/?v=1234567890");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://www.facebook.com/watch/?v=1234567890",
        canonicalUrl: "https://www.facebook.com/watch/?v=1234567890",
      },
    });
  });

  it("keeps exactly ?v=<id> for /watch?v=<id>&extra=junk, dropping every other key", () => {
    const result = parseEmbed("https://www.facebook.com/watch?v=1234567890&extra=junk");
    expect(result).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://www.facebook.com/watch/?v=1234567890",
        canonicalUrl: "https://www.facebook.com/watch/?v=1234567890",
      },
    });
  });

  it("returns reason: 'unsupported' for /watch with no v param, rather than the Watch homepage", () => {
    expect(parseEmbed("https://www.facebook.com/watch/")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseEmbed("https://www.facebook.com/watch")).toEqual({ ok: false, reason: "unsupported" });
    expect(parseEmbed("https://www.facebook.com/watch?ref=share")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });
});

describe("parseEmbed — fb.watch is a recognised short link, not guessed and not unsupported (B3)", () => {
  it("returns reason: 'short-link' for a bare fb.watch URL instead of guessing post vs. video", () => {
    expect(parseEmbed("https://fb.watch/abc123/")).toEqual({ ok: false, reason: "short-link" });
  });

  it("returns reason: 'short-link' for markup whose only link is fb.watch", () => {
    const html = '<blockquote><a href="https://fb.watch/xyz789/">Video</a></blockquote>';
    expect(parseEmbed(html)).toEqual({ ok: false, reason: "short-link" });
  });

  it("prefers a resolvable X embed over a co-occurring fb.watch link — a resolvable embed always wins", () => {
    const html = '<a href="https://x.com/a/status/1">Tweet</a> <a href="https://fb.watch/abc123/">Video</a>';
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: { platform: "x", id: "1", canonicalUrl: "https://x.com/a/status/1" },
    });
  });
});

describe("parseEmbed — TikTok is no longer a supported platform", () => {
  it("returns reason: 'unsupported' for a TikTok video URL", () => {
    expect(parseEmbed("https://www.tiktok.com/@mfmsport/video/7412345678901234567")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });
});

describe("parseEmbed — pasted markup is reduced to a canonical URL, never stored as HTML", () => {
  it("extracts a tweet URL from an href inside a pasted blockquote", () => {
    const html = '<blockquote class="twitter-tweet"><a href="https://x.com/a/status/1"></a></blockquote>';
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: { platform: "x", id: "1", canonicalUrl: "https://x.com/a/status/1" },
    });
  });

  it("extracts an Instagram URL from data-instgrm-permalink", () => {
    const html =
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABC/"></blockquote>';
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: { platform: "instagram", id: "ABC", canonicalUrl: "https://www.instagram.com/p/ABC/" },
    });
  });

  it("extracts a Facebook URL from data-href", () => {
    const html = '<div class="fb-video" data-href="https://www.facebook.com/MFMSport/videos/1"></div>';
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: {
        platform: "facebook",
        id: "https://www.facebook.com/MFMSport/videos/1",
        canonicalUrl: "https://www.facebook.com/MFMSport/videos/1",
      },
    });
  });

  it("extracts a YouTube URL from an iframe src", () => {
    const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: {
        platform: "youtube",
        id: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
  });

  it("decodes an &amp;-escaped URL before parsing", () => {
    const html = '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;feature=share">شاهد</a>';
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: {
        platform: "youtube",
        id: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
  });

  it("returns reason: 'unsupported' when markup's only URL is off-platform", () => {
    expect(parseEmbed('<iframe src="https://evil.com/x"></iframe>')).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("returns reason: 'unsupported' for a bare iframe pointing off-platform", () => {
    expect(parseEmbed('<iframe src="https://example.com/x"></iframe>')).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("returns reason: 'unsupported' for an Instagram-marker blockquote with no href to extract", () => {
    expect(parseEmbed('<blockquote class="instagram-media"></blockquote>')).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("returns reason: 'unsupported' for a Facebook-marker div whose data-href isn't a real URL", () => {
    expect(parseEmbed('<div class="fb-video" data-href="x"></div>')).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("returns reason: 'unsupported' for TikTok markup now that TikTok is unsupported", () => {
    expect(parseEmbed('<blockquote class="tiktok-embed"></blockquote>')).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });
});

describe("parseEmbed — security and URL parsing robustness", () => {
  it("rejects Twitter URLs with quote characters in the username (XSS attempt)", () => {
    expect(parseEmbed('https://twitter.com/a" onmouseover="alert(1)/status/123')).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("rejects substring matches for YouTube (hostname must match exactly)", () => {
    expect(parseEmbed("https://evil.com/?x=youtube.com/watch?v=AAAAAAAAAAA")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("rejects substring matches for Facebook (hostname must match exactly)", () => {
    expect(parseEmbed("https://notfacebook.com/")).toEqual({ ok: false, reason: "unsupported" });
  });

  it("rejects l.facebook.com (redirect host, not in allowlist)", () => {
    expect(parseEmbed("https://l.facebook.com/l.php?u=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });

  it("rejects malformed URLs without throwing", () => {
    const malformed = ["https://", "http://[", "://invalid"];
    for (const url of malformed) {
      expect(() => parseEmbed(url)).not.toThrow();
      expect(parseEmbed(url)).toEqual({ ok: false, reason: "unsupported" });
    }
  });
});

describe("parseEmbed — decoy URLs: distinct {platform, id} pairs (B1)", () => {
  it("a real X blockquote for a single tweet resolves (its own status link occurs once)", () => {
    expect(parseEmbed(JACK_TWEET_HTML)).toEqual({
      ok: true,
      embed: { platform: "x", id: "20", canonicalUrl: "https://x.com/jack/status/20" },
    });
  });

  it("twitter.com and x.com URLs for the same status in one snippet resolve — same pair, not multiple", () => {
    const snippet = "See https://twitter.com/a/status/1 also mirrored at https://x.com/a/status/1";
    expect(parseEmbed(snippet)).toEqual({
      ok: true,
      embed: { platform: "x", id: "1", canonicalUrl: "https://x.com/a/status/1" },
    });
  });

  it("a real embed plus a decoy inside an HTML comment resolves to the real one, not 'multiple'", () => {
    const html = `${JACK_TWEET_HTML}\n<!-- decoy: https://x.com/decoy/status/999 -->`;
    expect(parseEmbed(html)).toEqual({
      ok: true,
      embed: { platform: "x", id: "20", canonicalUrl: "https://x.com/jack/status/20" },
    });
  });

  it("a script block's URL does not count as a candidate — the only URL is inside <script>", () => {
    const html = '<script>var u = "https://x.com/a/status/1";</script>';
    expect(parseEmbed(html)).toEqual({ ok: false, reason: "unsupported" });
  });

  it("a comment's URL does not count as a candidate — the only URL is inside <!-- -->", () => {
    const html = "<!-- https://x.com/a/status/1 -->";
    expect(parseEmbed(html)).toEqual({ ok: false, reason: "unsupported" });
  });

  it("a real X blockquote for a quoted tweet returns reason: 'multiple' (two genuinely distinct posts)", () => {
    const pastedTogether = `${OPTAJOE_QUOTE_TWEET_HTML}\n${QUOTED_TWEET_HTML}`;
    expect(parseEmbed(pastedTogether)).toEqual({ ok: false, reason: "multiple" });
  });

  it("an Instagram blockquote carrying a permalink plus profile links resolves — profile links contribute no pair", () => {
    expect(parseEmbed(INSTAGRAM_BLOCKQUOTE_HTML)).toEqual({
      ok: true,
      embed: {
        platform: "instagram",
        id: "C1a2B3c4D5e",
        canonicalUrl: "https://www.instagram.com/p/C1a2B3c4D5e/",
      },
    });
  });

  it("a YouTube iframe plus a different YouTube link returns reason: 'multiple'", () => {
    const html =
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><p>Also see <a href="https://youtu.be/9bZkp7q19f0">this one</a></p>';
    expect(parseEmbed(html)).toEqual({ ok: false, reason: "multiple" });
  });
});
