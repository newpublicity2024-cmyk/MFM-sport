import { getMatchStatus, type MatchStatus } from "./types";

/**
 * schema.org EventStatusType values the match page can truthfully claim.
 * Google reads `eventStatus` on `SportsEvent`; anything else here would be a
 * made-up vocabulary term.
 */
export type SchemaEventStatus =
  | "https://schema.org/EventScheduled"
  | "https://schema.org/EventPostponed"
  | "https://schema.org/EventCancelled";

export type StatusDescription = {
  /** Coarse phase the UI already keys its behaviour on. */
  phase: MatchStatus;
  /**
   * i18n key under `match.status.*` for a human label, or null when the
   * scoreboard's own presentation (date + kickoff, live minute) says it all.
   */
  labelKey: string | null;
  eventStatus: SchemaEventStatus;
};

/**
 * Every short status API-Football documents, mapped once. Codes not listed
 * (a future addition upstream) fall back to the coarse phase with no label,
 * which is what the page did before this table existed.
 */
const STATUS_TABLE: Record<string, Omit<StatusDescription, "phase">> = {
  TBD: { labelKey: "tbd", eventStatus: "https://schema.org/EventScheduled" },
  NS: { labelKey: null, eventStatus: "https://schema.org/EventScheduled" },
  "1H": { labelKey: null, eventStatus: "https://schema.org/EventScheduled" },
  HT: { labelKey: "halfTime", eventStatus: "https://schema.org/EventScheduled" },
  "2H": { labelKey: null, eventStatus: "https://schema.org/EventScheduled" },
  ET: { labelKey: "extraTime", eventStatus: "https://schema.org/EventScheduled" },
  BT: { labelKey: "breakTime", eventStatus: "https://schema.org/EventScheduled" },
  P: { labelKey: "penalties", eventStatus: "https://schema.org/EventScheduled" },
  SUSP: { labelKey: "suspended", eventStatus: "https://schema.org/EventScheduled" },
  INT: { labelKey: "interrupted", eventStatus: "https://schema.org/EventScheduled" },
  LIVE: { labelKey: null, eventStatus: "https://schema.org/EventScheduled" },
  FT: { labelKey: "fullTime", eventStatus: "https://schema.org/EventScheduled" },
  AET: { labelKey: "afterExtraTime", eventStatus: "https://schema.org/EventScheduled" },
  PEN: { labelKey: "afterPenalties", eventStatus: "https://schema.org/EventScheduled" },
  PST: { labelKey: "postponed", eventStatus: "https://schema.org/EventPostponed" },
  CANC: { labelKey: "cancelled", eventStatus: "https://schema.org/EventCancelled" },
  ABD: { labelKey: "abandoned", eventStatus: "https://schema.org/EventCancelled" },
  AWD: { labelKey: "awarded", eventStatus: "https://schema.org/EventScheduled" },
  WO: { labelKey: "walkover", eventStatus: "https://schema.org/EventScheduled" },
};

export const KNOWN_STATUS_CODES = Object.keys(STATUS_TABLE);

export function describeStatus(shortStatus: string): StatusDescription {
  const row = STATUS_TABLE[shortStatus];
  return {
    phase: getMatchStatus(shortStatus),
    labelKey: row?.labelKey ?? null,
    eventStatus: row?.eventStatus ?? "https://schema.org/EventScheduled",
  };
}

/** Statuses whose final score is real — the results list and derived stats read only these. */
export function hasFinalScore(shortStatus: string): boolean {
  return ["FT", "AET", "PEN"].includes(shortStatus);
}
