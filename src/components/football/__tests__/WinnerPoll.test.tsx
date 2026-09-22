import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { WinnerPoll } from "@/components/football/WinnerPoll";
import { PHYSICAL_DIRECTION } from "./fixtures";

const labels = {
  title: "من سيفوز؟", draw: "تعادل", vote: "اختر توقّعك", thanks: "شكرًا، تم تسجيل توقّعك",
  closed: "أُغلق التصويت عند انطلاق المباراة", votes: "صوت", error: "تعذّر تسجيل التصويت، حاول مرة أخرى",
};
const home = { id: 1, name: "Home", logo: "/h.png" };
const away = { id: 2, name: "Away", logo: "/a.png" };

function setup(props: Partial<React.ComponentProps<typeof WinnerPoll>> = {}) {
  return render(
    <WinnerPoll fixtureId={77} home={home} away={away} homeName="الوداد" awayName="الرجاء" labels={labels} open {...props} />,
  );
}

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => jsonResponse({ available: true, counts: { home: 0, draw: 0, away: 0 }, percentages: { home: 0, draw: 0, away: 0 }, total: 0, myVote: null })));
});
afterEach(() => vi.unstubAllGlobals());

describe("WinnerPoll", () => {
  it("offers three choices with the teams' Arabic names and no counts before anything loads", () => {
    const { container } = setup();
    const buttons = container.querySelectorAll("button[data-choice]");
    expect([...buttons].map((b) => b.getAttribute("data-choice"))).toEqual(["home", "draw", "away"]);
    expect(container.textContent).toContain("الوداد");
    expect(container.textContent).toContain("الرجاء");
    expect(container.textContent).toContain("تعادل");
    expect(container.querySelector("[data-share]")).toBeNull();
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  it("shows percentage bars after a vote and locks further voting", async () => {
    const fetchMock = vi.mocked(fetch);
    setup();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockImplementationOnce(() =>
      jsonResponse({ available: true, counts: { home: 2, draw: 1, away: 1 }, percentages: { home: 50, draw: 25, away: 25 }, total: 4, myVote: "home", recorded: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: /الوداد/ }));
    await waitFor(() => expect(screen.getByText("50%")).toBeInTheDocument());
    expect(screen.getByText("شكرًا، تم تسجيل توقّعك")).toBeInTheDocument();
    expect(screen.getByText("4 صوت")).toBeInTheDocument();
    for (const b of document.querySelectorAll("button[data-choice]")) {
      expect(b).toBeDisabled();
    }
    // The POST carried the choice as JSON, never as a link.
    const [, init] = fetchMock.mock.calls[1]!;
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ choice: "home" });
  });

  it("marks the visitor's own choice", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse({ available: true, counts: { home: 1, draw: 0, away: 0 }, percentages: { home: 100, draw: 0, away: 0 }, total: 1, myVote: "draw" }),
    );
    const { container } = setup();
    await waitFor(() => expect(container.querySelector("[data-choice='draw']")).toHaveAttribute("aria-pressed", "true"));
    expect(container.querySelector("[data-choice='home']")).toHaveAttribute("aria-pressed", "false");
  });

  it("shows results without voting once the match has started", async () => {
    vi.mocked(fetch).mockImplementation(() =>
      jsonResponse({ available: true, counts: { home: 3, draw: 0, away: 1 }, percentages: { home: 75, draw: 0, away: 25 }, total: 4, myVote: null }),
    );
    const { container } = setup({ open: false });
    await waitFor(() => expect(screen.getByText("75%")).toBeInTheDocument());
    expect(screen.getByText(labels.closed)).toBeInTheDocument();
    for (const b of container.querySelectorAll("button[data-choice]")) expect(b).toBeDisabled();
  });

  it("does not POST when the poll is closed", async () => {
    const fetchMock = vi.mocked(fetch);
    setup({ open: false });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /الوداد/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("removes itself when the store is unavailable", async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({ available: false }));
    const { container } = setup();
    await waitFor(() => expect(container.querySelector("[data-block='poll']")).toBeNull());
  });

  it("keeps the section when the counts fetch fails mid-vote and says so", async () => {
    const fetchMock = vi.mocked(fetch);
    setup();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error("network")));
    fireEvent.click(screen.getByRole("button", { name: /الرجاء/ }));
    await waitFor(() => expect(screen.getByText(labels.error)).toBeInTheDocument());
  });

  it("reserves its height so the late fetch does not shift the page", () => {
    const { container } = setup();
    expect(container.querySelector("[data-block='poll']")!.className).toMatch(/min-h-/);
  });

  it("RTL: the home choice is first in the DOM and only logical direction classes are used", () => {
    const { container } = setup();
    expect(container.querySelector("button[data-choice]")!.getAttribute("data-choice")).toBe("home");
    for (const el of container.querySelectorAll("[class]")) {
      expect(el.className, el.outerHTML.slice(0, 80)).not.toMatch(PHYSICAL_DIRECTION);
    }
  });
});
