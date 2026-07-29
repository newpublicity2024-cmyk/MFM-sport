import type { EmbedPlatform } from "./parseEmbed";

/**
 * Loads a platform SDK at most once per page, then asks it to scan `host`.
 *
 * Needed for two paths: a tweet we built ourselves from a URL, and a pasted
 * snippet whose author copied only the markup without the loader. Never rejects
 * -- an ad blocker eating the SDK must leave the article intact.
 */

const SDK_SRC: Record<EmbedPlatform, string> = {
  twitter: "https://platform.twitter.com/widgets.js",
  instagram: "https://www.instagram.com/embed.js",
  facebook: "https://connect.facebook.net/ar_AR/sdk.js#xfbml=1&version=v21.0",
  tiktok: "https://www.tiktok.com/embed.js",
};

const pending = new Map<EmbedPlatform, Promise<void>>();

function injectOnce(platform: EmbedPlatform): Promise<void> {
  const existing = pending.get(platform);
  if (existing) return existing;

  const src = SDK_SRC[platform];
  // The pasted snippet may already carry the loader; don't add a second copy.
  const base = src.split("#")[0];
  if (document.querySelector(`script[src^="${base}"]`)) {
    const resolved = Promise.resolve();
    pending.set(platform, resolved);
    return resolved;
  }

  const promise = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    // Resolve rather than reject: a blocked SDK is a missing embed, not a broken page.
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });

  pending.set(platform, promise);
  return promise;
}

type SdkWindow = {
  twttr?: { widgets?: { load?: (el?: HTMLElement) => void } };
  instgrm?: { Embeds?: { process?: () => void } };
  FB?: { XFBML?: { parse?: (el?: HTMLElement) => void } };
};

export async function loadEmbedScript(platform: EmbedPlatform, host: HTMLElement): Promise<void> {
  await injectOnce(platform);
  const sdk = window as unknown as SdkWindow;

  switch (platform) {
    case "twitter":
      sdk.twttr?.widgets?.load?.(host);
      break;
    case "instagram":
      sdk.instgrm?.Embeds?.process?.();
      break;
    case "facebook":
      sdk.FB?.XFBML?.parse?.(host);
      break;
    case "tiktok":
      // embed.js scans the document itself on load; it exposes no re-parse API.
      break;
  }
}
