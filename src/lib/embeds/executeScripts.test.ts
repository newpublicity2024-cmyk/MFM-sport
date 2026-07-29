import { describe, it, expect, beforeEach } from "vitest";
import { executeScripts } from "./executeScripts";

describe("executeScripts", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as unknown as Record<string, unknown>).__ran;
  });

  it("runs an inline script that innerHTML left inert", () => {
    const host = document.createElement("div");
    host.innerHTML = '<script>window.__ran = true;</script>';
    document.body.appendChild(host);

    expect((window as unknown as Record<string, unknown>).__ran).toBeUndefined();

    executeScripts(host);

    expect((window as unknown as Record<string, unknown>).__ran).toBe(true);
  });

  it("preserves attributes when re-injecting", () => {
    const host = document.createElement("div");
    host.innerHTML = '<script src="https://example.com/a.js" async charset="utf-8"></script>';
    document.body.appendChild(host);

    executeScripts(host);

    const script = host.querySelector("script");
    expect(script?.getAttribute("src")).toBe("https://example.com/a.js");
    expect(script?.hasAttribute("async")).toBe(true);
    expect(script?.getAttribute("charset")).toBe("utf-8");
  });

  it("does nothing when there are no scripts", () => {
    const host = document.createElement("div");
    host.innerHTML = "<p>مرحبا</p>";
    expect(() => executeScripts(host)).not.toThrow();
    expect(host.innerHTML).toBe("<p>مرحبا</p>");
  });
});
