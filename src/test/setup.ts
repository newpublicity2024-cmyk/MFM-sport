import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Shim a `jest` global so @testing-library/dom can detect Vitest fake timers
// (its detection checks `typeof jest !== 'undefined'` and calls
// `jest.advanceTimersByTime` from inside `waitFor`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as unknown as { jest: typeof vi }).jest = vi;
