import { describe, it, expect } from "vitest";
import { describeStatus, hasFinalScore, KNOWN_STATUS_CODES } from "../status";
import { getMatchStatus } from "../types";

const ALL_CODES = [
  "TBD", "NS", "1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE",
  "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO",
];

describe("describeStatus", () => {
  it("covers every status code API-Football documents", () => {
    expect([...KNOWN_STATUS_CODES].sort()).toEqual([...ALL_CODES].sort());
  });

  it("agrees with getMatchStatus on the coarse phase for every code", () => {
    for (const code of ALL_CODES) {
      expect(describeStatus(code).phase).toBe(getMatchStatus(code));
    }
  });

  it("maps postponed and cancelled/abandoned to their schema.org statuses", () => {
    expect(describeStatus("PST").eventStatus).toBe("https://schema.org/EventPostponed");
    expect(describeStatus("CANC").eventStatus).toBe("https://schema.org/EventCancelled");
    expect(describeStatus("ABD").eventStatus).toBe("https://schema.org/EventCancelled");
  });

  it("keeps every played, live or scheduled state as EventScheduled", () => {
    for (const code of ["NS", "TBD", "1H", "HT", "FT", "AET", "PEN", "AWD", "WO", "SUSP"]) {
      expect(describeStatus(code).eventStatus).toBe("https://schema.org/EventScheduled");
    }
  });

  it("gives a label to every state the scoreboard cannot express on its own", () => {
    for (const code of ["TBD", "HT", "ET", "BT", "P", "SUSP", "INT", "FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"]) {
      expect(describeStatus(code).labelKey, code).toBeTruthy();
    }
    // Kickoff time / live minute carry these; no extra label.
    for (const code of ["NS", "1H", "2H", "LIVE"]) {
      expect(describeStatus(code).labelKey, code).toBeNull();
    }
  });

  it("degrades an unknown code to the coarse phase with no label", () => {
    expect(describeStatus("XYZ")).toEqual({
      phase: "other",
      labelKey: null,
      eventStatus: "https://schema.org/EventScheduled",
    });
  });
});

describe("hasFinalScore", () => {
  it("is true only for played-out matches", () => {
    expect(ALL_CODES.filter(hasFinalScore)).toEqual(["FT", "AET", "PEN"]);
  });
});
