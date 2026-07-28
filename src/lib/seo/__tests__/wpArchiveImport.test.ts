import { describe, expect, it } from "vitest";
import {
  bodyTextLength,
  extractYouTubeUrl,
  legacyPathFromLink,
  resolvePublishedAt,
  stripDeadMedia,
  tierFor,
} from "../wpArchive";

describe("bodyTextLength", () => {
  it("counts text inside a CDATA section", () => {
    // The regression that mattered: stripping tags with /<[^>]+>/ before removing
    // the CDATA wrapper swallowed the whole section, because `<![CDATA[` opens
    // with "<" and `]]>` closes with ">". It reported 2,224 posts as empty when
    // only 4 are.
    const raw = "<content:encoded><![CDATA[أصبح فريق الأمل الرياضي للحاجب لكرة السلة]]></content:encoded>";
    expect(bodyTextLength(raw)).toBeGreaterThan(30);
  });

  it("counts text in ordinary HTML", () => {
    expect(bodyTextLength("<p>مرحبا بالعالم</p>")).toBe("مرحبا بالعالم".length);
  });

  it("reports markup with no text as empty", () => {
    expect(bodyTextLength("<p><iframe src='https://youtube.com/embed/x'></iframe></p>")).toBe(0);
  });

  it("drops shortcodes", () => {
    expect(bodyTextLength("<p>[gallery ids='1,2,3']</p>")).toBe(0);
  });
});

describe("tierFor", () => {
  it("splits on 500 characters", () => {
    expect(tierFor(499)).toBe("archive-brief");
    expect(tierFor(500)).toBe("archive-full");
    expect(tierFor(0)).toBe("archive-brief");
  });
});

describe("resolvePublishedAt", () => {
  it("uses the first usable candidate", () => {
    expect(resolvePublishedAt("2021-05-09 11:30:00")).toBe("2021-05-09T11:30:00.000Z");
  });

  it("falls through WordPress zero-dates instead of throwing", () => {
    // Two real posts carry 0000-00-00; `new Date()` yields Invalid Date and
    // toISOString() throws, which used to abort the row and lose its redirect.
    expect(resolvePublishedAt("0000-00-00 00:00:00", "2019-03-25 08:00:00")).toBe(
      "2019-03-25T08:00:00.000Z",
    );
  });

  it("returns null when nothing is usable, so the caller can skip", () => {
    expect(resolvePublishedAt("0000-00-00 00:00:00", "", null, undefined)).toBeNull();
    expect(resolvePublishedAt("not-a-date")).toBeNull();
  });
});

describe("extractYouTubeUrl", () => {
  it("finds an embedded player, the video-only post case", () => {
    const html = `<p><iframe src="https://www.youtube.com/embed/L3h5p8LJqU4?enablejsapi=1&autoplay=1"></iframe></p>`;
    expect(extractYouTubeUrl(html)).toBe("https://www.youtube.com/watch?v=L3h5p8LJqU4");
  });

  it("handles watch and short-link forms", () => {
    expect(extractYouTubeUrl(`<a href="https://youtu.be/abc123XYZ">x</a>`)).toBe(
      "https://www.youtube.com/watch?v=abc123XYZ",
    );
    expect(extractYouTubeUrl(`https://www.youtube.com/watch?v=abc123XYZ`)).toBe(
      "https://www.youtube.com/watch?v=abc123XYZ",
    );
  });

  it("returns null when there is no video", () => {
    expect(extractYouTubeUrl("<p>نص عادي</p>")).toBeNull();
  });
});

describe("stripDeadMedia", () => {
  it("removes images pointing at the decommissioned uploads host", () => {
    const html = `<p>قبل</p><img src="https://mfmsport.ma/wp-content/uploads/2020/02/x.jpg"/><p>بعد</p>`;
    const out = stripDeadMedia(html);
    expect(out).not.toContain("<img");
    expect(out).toContain("قبل");
    expect(out).toContain("بعد");
  });

  it("removes figures wholesale and collapses the empty paragraphs left behind", () => {
    expect(stripDeadMedia(`<figure><img src="x"/><figcaption>ك</figcaption></figure><p></p>`)).toBe("");
  });
});

describe("legacyPathFromLink", () => {
  it("keeps the percent-encoding and trailing slash the middleware will receive", () => {
    expect(legacyPathFromLink("https://mfmsport.ma/%d8%b3%d9%84%d8%a9/")).toBe("/%d8%b3%d9%84%d8%a9/");
  });

  it("adds a trailing slash when WordPress omitted it", () => {
    expect(legacyPathFromLink("https://mfmsport.ma/some-post")).toBe("/some-post/");
  });

  it("returns null for an unparseable link", () => {
    expect(legacyPathFromLink("not a url")).toBeNull();
  });
});
