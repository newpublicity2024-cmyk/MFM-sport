/**
 * Re-injects every <script> inside `host` as a fresh element so it actually runs.
 *
 * Assigning markup through innerHTML leaves its <script> tags inert -- the HTML
 * spec says so. A journalist pasting an embed snippet that carries its own loader
 * would otherwise get a blockquote that never turns into a post.
 */
export function executeScripts(host: HTMLElement): void {
  for (const old of Array.from(host.querySelectorAll("script"))) {
    const fresh = document.createElement("script");
    for (const attr of Array.from(old.attributes)) {
      fresh.setAttribute(attr.name, attr.value);
    }
    fresh.text = old.text;
    old.replaceWith(fresh);
  }
}
