import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ResultRow } from "@/components/football/ResultRow";
import { localizeTeam } from "@/lib/api-football/localize";
import { makeFixture, PHYSICAL_DIRECTION } from "./fixtures";

const labels = { win: "فوز", draw: "تعادل", loss: "خسارة", atHome: "مستضيف", away: "خارج الديار" };
const WAC = 968;

function row(ui: React.ReactElement) {
  const { container } = render(<ul>{ui}</ul>);
  return container;
}

describe("ResultRow — column perspective (recent results)", () => {
  it("shows the score as team–opponent whichever side the team played", () => {
    // Team at home, won 2-0.
    const atHome = row(<ResultRow fixture={makeFixture({ id: 1, homeId: WAC, awayId: 5, home: 2, away: 0 })} locale="ar" labels={labels} perspectiveTeamId={WAC} />);
    expect(atHome.querySelector("[data-score]")!.getAttribute("data-score")).toBe("2-0");
    expect(atHome.querySelector("[data-result]")!.getAttribute("data-result")).toBe("W");
    // Same team AWAY, won 2-0 (API renders it 0-2): still 2-0 from its side.
    const away = row(<ResultRow fixture={makeFixture({ id: 2, homeId: 5, awayId: WAC, home: 0, away: 2 })} locale="ar" labels={labels} perspectiveTeamId={WAC} />);
    expect(away.querySelector("[data-score]")!.getAttribute("data-score")).toBe("2-0");
    expect(away.querySelector("[data-result]")!.getAttribute("data-result")).toBe("W");
  });

  it("names only the opponent — the column's own team never appears in the row", () => {
    const OPP = 90005; // no dictionary entry: the Latin name is rendered as-is
    const c = row(<ResultRow fixture={makeFixture({ id: 3, homeId: OPP, awayId: WAC, home: 1, away: 1 })} locale="ar" labels={labels} perspectiveTeamId={WAC} />);
    expect(c.querySelector("[data-opponent]")!.getAttribute("data-opponent")).toBe(String(OPP));
    expect(c.querySelector("[data-opponent]")!.textContent).toContain(localizeTeam(OPP, `Team ${OPP}`, "ar"));
    expect(c.textContent).not.toContain(localizeTeam(WAC, `Team ${WAC}`, "ar"));
  });

  it("marks home and away so the venue is never guessed from the name order", () => {
    const home = row(<ResultRow fixture={makeFixture({ id: 4, homeId: WAC, awayId: 5 })} locale="ar" labels={labels} perspectiveTeamId={WAC} />);
    expect(home.querySelector("[data-venue]")!.getAttribute("data-venue")).toBe("home");
    expect(home.querySelector("[data-venue]")!.textContent).toBe("مستضيف");
    const away = row(<ResultRow fixture={makeFixture({ id: 5, homeId: 5, awayId: WAC })} locale="ar" labels={labels} perspectiveTeamId={WAC} />);
    expect(away.querySelector("[data-venue]")!.getAttribute("data-venue")).toBe("away");
  });

  it("keeps the date and competition in one fixed leading slot", () => {
    const c = row(<ResultRow fixture={makeFixture({ id: 6, homeId: WAC, awayId: 5 })} locale="ar" labels={labels} perspectiveTeamId={WAC} />);
    const lead = c.querySelector("li > * > span")!;
    expect(lead.textContent).toContain("2026");
    expect(lead.textContent).toContain("البطولة الاحترافية");
  });
});

describe("ResultRow — fixed first team (head to head)", () => {
  const PAT = 90002;
  const NC = 90001;
  const nameOf = (id: number) => localizeTeam(id, `Team ${id}`, "ar");

  it("always puts the fixed team in the first slot, whoever hosted", () => {
    const aHome = row(<ResultRow fixture={makeFixture({ id: 7, homeId: NC, awayId: PAT, home: 2, away: 0 })} locale="ar" labels={labels} fixedFirstTeamId={NC} />);
    expect(aHome.querySelector("[data-slot='first']")!.textContent).toContain(nameOf(NC));
    expect(aHome.querySelector("[data-score]")!.getAttribute("data-score")).toBe("2-0");
    const aAway = row(<ResultRow fixture={makeFixture({ id: 8, homeId: PAT, awayId: NC, home: 1, away: 2 })} locale="ar" labels={labels} fixedFirstTeamId={NC} />);
    expect(aAway.querySelector("[data-slot='first']")!.textContent).toContain(nameOf(NC));
    // Score follows the slots: NC scored 2, PAT 1.
    expect(aAway.querySelector("[data-score]")!.getAttribute("data-score")).toBe("2-1");
  });

  it("marks which side hosted that meeting", () => {
    const c = row(<ResultRow fixture={makeFixture({ id: 9, homeId: PAT, awayId: NC, home: 1, away: 2 })} locale="ar" labels={labels} fixedFirstTeamId={NC} />);
    const tag = c.querySelector("[data-venue]")!;
    expect(tag.getAttribute("data-venue")).toBe("home");
    expect(tag.closest("[data-slot]")!.getAttribute("data-slot")).toBe("second");
  });

  it("carries no result badge (a neutral row belongs to neither team)", () => {
    const c = row(<ResultRow fixture={makeFixture({ id: 10, homeId: NC, awayId: PAT, home: 2, away: 0 })} locale="ar" labels={labels} fixedFirstTeamId={NC} />);
    expect(c.querySelector("[data-result]")).toBeNull();
  });
});

describe("ResultRow — linking and direction", () => {
  it("links an indexable fixture and leaves a non-indexable one as text", () => {
    const ok = row(<ResultRow fixture={makeFixture({ id: 11, leagueId: 200 })} locale="ar" labels={labels} perspectiveTeamId={968} />);
    expect(ok.querySelector("a[href='/ar/matches/11']")).not.toBeNull();
    const no = row(<ResultRow fixture={makeFixture({ id: 12, leagueId: 999 })} locale="ar" labels={labels} perspectiveTeamId={968} />);
    expect(no.querySelector("a")).toBeNull();
    expect(no.querySelector("[data-unlinked-fixture='12']")).not.toBeNull();
  });

  it("RTL: uses only logical direction classes", () => {
    const c = row(<ResultRow fixture={makeFixture({ id: 13 })} locale="ar" labels={labels} perspectiveTeamId={968} />);
    for (const el of c.querySelectorAll("[class]")) {
      expect(el.className, el.outerHTML.slice(0, 80)).not.toMatch(PHYSICAL_DIRECTION);
    }
  });
});
