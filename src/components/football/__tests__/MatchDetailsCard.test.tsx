import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ApiFixture } from "@/lib/api-football/types";
import { MatchDetailsCard } from "@/components/football/MatchDetailsCard";

const labels = {
  details: "تفاصيل",
  competition: "المسابقة",
  round: "الجولة",
  kickoffTime: "موعد الانطلاق",
  moroccoTime: "بتوقيت المغرب",
  venue: "الملعب",
  referee: "الحكم",
  timeToBeConfirmed: "لم يُحدَّد الموعد",
};

function fixture(over: Partial<ApiFixture["fixture"]> = {}): ApiFixture {
  return {
    fixture: {
      id: 1550109,
      date: "2026-09-07T16:30:00+00:00",
      timestamp: 0,
      venue: { id: 1, name: "Unipol Domus", city: "Cagliari" },
      status: { long: "Match Finished", short: "FT", elapsed: 90 },
      referee: "M. Guida",
      ...over,
    },
    league: { id: 135, name: "Serie A", country: "Italy", logo: "/l.png", flag: "https://media.api-sports.io/flags/it.svg", season: 2026, round: "Regular Season - 3" },
    teams: {
      home: { id: 490, name: "Cagliari", logo: "/h.png", winner: false },
      away: { id: 867, name: "Lecce", logo: "/a.png", winner: true },
    },
    goals: { home: 1, away: 2 },
    score: {
      halftime: { home: 0, away: 1 }, fulltime: { home: 1, away: 2 },
      extratime: { home: null, away: null }, penalty: { home: null, away: null },
    },
  };
}

describe("MatchDetailsCard", () => {
  it("wraps the kick-off in a <time> whose datetime is the raw UTC instant and whose text is Casablanca time", () => {
    const { container } = render(<MatchDetailsCard fixture={fixture()} locale="ar" labels={labels} />);
    const times = container.querySelectorAll("time");
    expect(times).toHaveLength(1);
    expect(times[0].getAttribute("datetime")).toBe("2026-09-07T16:30:00+00:00");
    // 16:30Z is 17:30 in Morocco in September — the bug the page shipped with.
    expect(times[0].textContent).toContain("17:30");
    expect(times[0].textContent).not.toContain("16:30");
    expect(screen.getByText("بتوقيت المغرب")).toBeInTheDocument();
  });

  it("renders the localized round, venue with city, and referee", () => {
    render(<MatchDetailsCard fixture={fixture()} locale="ar" labels={labels} />);
    expect(screen.getByText("الأسبوع 3")).toBeInTheDocument();
    expect(screen.getByText("Unipol Domus، Cagliari")).toBeInTheDocument();
    expect(screen.getByText("M. Guida")).toBeInTheDocument();
  });

  it("omits the venue and referee rows when upstream has none", () => {
    render(<MatchDetailsCard fixture={fixture({ venue: null, referee: null })} locale="ar" labels={labels} />);
    expect(screen.queryByText("الملعب")).toBeNull();
    expect(screen.queryByText("الحكم")).toBeNull();
    // The rows that always exist are still there.
    expect(screen.getByText("المسابقة")).toBeInTheDocument();
    expect(screen.getByText("موعد الانطلاق")).toBeInTheDocument();
  });

  it("shows the date with a 'time to be confirmed' label instead of a clock for TBD fixtures", () => {
    const { container } = render(
      <MatchDetailsCard
        fixture={fixture({ date: "2026-11-01T00:00:00+00:00", status: { long: "", short: "TBD", elapsed: null } })}
        locale="ar"
        labels={labels}
      />,
    );
    const time = container.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("2026-11-01T00:00:00+00:00");
    expect(time.textContent).toContain("لم يُحدَّد الموعد");
    expect(time.textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(screen.queryByText("بتوقيت المغرب")).toBeNull();
  });
});
