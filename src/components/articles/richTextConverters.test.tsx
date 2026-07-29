import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("react-tweet", () => ({
  Tweet: (props: { id: string }) => <div data-testid="tweet" data-id={props.id} />,
}));

describe("articleJSXConverters", () => {
  it("overrides the default upload converter and registers exactly the four block converters", async () => {
    const { articleJSXConverters } = await import("./richTextConverters");
    const { defaultJSXConverters } = await import("@payloadcms/richtext-lexical/react");

    const converters = articleJSXConverters({ defaultConverters: defaultJSXConverters });

    expect(converters.upload).toBeDefined();
    expect(converters.upload).not.toBe(defaultJSXConverters.upload);
    expect(Object.keys(converters.blocks ?? {}).sort()).toEqual([
      "audio",
      "embedFrame",
      "gallery",
      "socialEmbed",
    ]);
  });

  it("wires the socialEmbed block converter through to a real embed renderer", async () => {
    const { articleJSXConverters } = await import("./richTextConverters");
    const { defaultJSXConverters } = await import("@payloadcms/richtext-lexical/react");
    const converters = articleJSXConverters({ defaultConverters: defaultJSXConverters });

    const node = {
      type: "block" as const,
      fields: {
        blockType: "socialEmbed" as const,
        source: "https://www.instagram.com/p/ABC123/",
        caption: "لقطة من المباراة",
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsx = (converters.blocks!.socialEmbed as any)({ node });
    const { container } = render(<>{jsx}</>);
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://www.instagram.com/p/ABC123/embed",
    );
  });

  it("wires the gallery block converter through to the Gallery component", async () => {
    const { articleJSXConverters } = await import("./richTextConverters");
    const { defaultJSXConverters } = await import("@payloadcms/richtext-lexical/react");
    const converters = articleJSXConverters({ defaultConverters: defaultJSXConverters });

    const node = {
      type: "block" as const,
      fields: {
        blockType: "gallery" as const,
        layout: "grid" as const,
        images: [{ image: { id: 1, url: "https://x/1.jpg", alt: "a" }, caption: null, id: "a" }],
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsx = (converters.blocks!.gallery as any)({ node });
    const { container } = render(<>{jsx}</>);
    expect(container.querySelector("[data-gallery-grid]")).toBeTruthy();
  });

  it("wires the audio block converter through to the Audio component", async () => {
    const { articleJSXConverters } = await import("./richTextConverters");
    const { defaultJSXConverters } = await import("@payloadcms/richtext-lexical/react");
    const converters = articleJSXConverters({ defaultConverters: defaultJSXConverters });

    const node = {
      type: "block" as const,
      fields: {
        blockType: "audio" as const,
        file: { id: 1, url: "https://x/a.mp3", mimeType: "audio/mpeg" },
        title: "مقابلة",
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsx = (converters.blocks!.audio as any)({ node });
    const { container } = render(<>{jsx}</>);
    expect(container.querySelector("audio")).toBeTruthy();
  });

  it("wires the embedFrame block converter through to the EmbedFrame component", async () => {
    const { articleJSXConverters } = await import("./richTextConverters");
    const { defaultJSXConverters } = await import("@payloadcms/richtext-lexical/react");
    const converters = articleJSXConverters({ defaultConverters: defaultJSXConverters });

    const node = {
      type: "block" as const,
      fields: {
        blockType: "embedFrame" as const,
        src: "https://w.soundcloud.com/player/?url=1",
        height: 166,
        title: "حلقة",
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsx = (converters.blocks!.embedFrame as any)({ node });
    const { container } = render(<>{jsx}</>);
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://w.soundcloud.com/player/?url=1",
    );
  });
});
