import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ApiFixture } from "@/lib/api-football/types";
import { localizeTeam } from "@/lib/api-football/localize";

vi.mock("@/hooks/useFixture", () => ({
  useFixture: () => ({ fixture: null, isLoading: false, error: null }),
}));

import { MatchHeader } from "@/components/football/MatchHeader";

const fixture: ApiFixture = {
  fixture: {
    id: 1,
    date: "2026-10-04T19:00:00+00:00",
    timestamp: 0,
    venue: null,
    status: { long: "Not Started", short: "NS", elapsed: null },
    referee: null,
  },
  league: { id: 200, name: "Botola Pro", country: "Morocco", logo: "/l.png", flag: null, season: 2026, round: "Regular Season - 8" },
  teams: {
    home: { id: 968, name: "Wydad AC", logo: "/h.png", winner: null },
    away: { id: 967, name: "Raja Casablanca", logo: "/a.png", winner: null },
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null }, fulltime: { home: null, away: null },
    extratime: { home: null, away: null }, penalty: { home: null, away: null },
  },
};

const messages = { match: { live: "مباشر", fullTime: "انتهت", status: { postponed: "مؤجلة", fullTime: "انتهت" } } };
function wrap(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="ar" messages={messages}>{ui}</NextIntlClientProvider>);
}

describe("MatchHeader", () => {
  it("renders exactly one h1 holding both localized team names, in Arabic", () => {
    const { container } = wrap(<MatchHeader fixture={fixture} locale="ar" />);
    const h1s = container.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    const text = h1s[0].textContent ?? "";
    expect(text).toContain(localizeTeam(968, "Wydad AC", "ar"));
    expect(text).toContain(localizeTeam(967, "Raja Casablanca", "ar"));
    expect(text).toContain("ضد");
    expect(text).not.toMatch(/[A-Za-z]/);
  });

  it("shows the competition and the localized round above the heading", () => {
    wrap(<MatchHeader fixture={fixture} locale="ar" />);
    expect(screen.getByText("الأسبوع 8")).toBeInTheDocument();
  });

  it("carries the status inside the scoreboard, not as a floating label under it", () => {
    const { container } = wrap(
      <MatchHeader
        fixture={{ ...fixture, fixture: { ...fixture.fixture, status: { long: "", short: "PST", elapsed: null } } }}
        locale="ar"
      />,
    );
    const label = container.querySelector("[data-status='PST']")!;
    expect(label).toHaveTextContent("مؤجلة");
    expect(label.closest("[data-phase]")).not.toBeNull();
    expect(container.querySelectorAll("header > p")).toHaveLength(0);
  });
});
