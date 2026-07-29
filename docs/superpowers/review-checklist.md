# Review checklist

Five items this project has paid for the hard way. Check these on every review before
anything else — each one has already shipped a real bug at least once.

1. **RTL directional assertions.** Any component with directional behaviour — carousels,
   scroll math, chevrons, slide transitions, swipe — carries an RTL assertion in its test
   file. A missing one is a review finding, not a nitpick: this is an Arabic-only site, so
   the bug is guaranteed to recur and is invisible to anyone reading the code in English.
   *Three occurrences: PR #30 (`LeagueCarousel`), PR #31 (`HeroSlider`), and the `Gallery`
   carousel's `scrollBy` sign flip on this branch.*

2. **Assert on the artefact a user receives, not a proxy for it.** A row count, a green
   build, a `grep -c`, or a computed statistic all *look* like evidence and none of them
   are — fetch the bytes a browser or crawler actually gets and check those. See
   [`docs/verification-principles.md`](../verification-principles.md) for the five bugs
   that taught this the hard way.

3. **A report describes shipped code only.** Check every named function, file and number
   in a report against the actual diff — a claim that doesn't match it is a finding, full
   stop. *Two occurrences on this branch: `task-2b-report.md` named a helper
   (`classifyCandidate`) that was never a separate function — the logic was inlined; and
   an earlier audit section presented a narrative transcript with invented-looking
   `(no output)` annotations in place of real command output.*

4. **Hostname allowlists match by exact equality — never `endsWith`, `includes`, or a
   substring regex.** `evil.com/?x=youtube.com` or `notsoundcloud.com` must fail closed.
   *Two occurrences: the design plan's own sample code for the embed parser matched
   platforms by substring, and the first implementation copied that sample verbatim
   before a reviewer caught it — both are the same bug, at two different steps of the
   same task.*

5. **No renderer may throw.** A malformed or unexpected node (missing `fields`, a
   `fields: null`, an unknown block type) must render nothing, never throw — turning a
   200 into a 500 on one bad row is worse than one missing block. *Origin: all four block
   converters in `richTextConverters.tsx` read `node.fields.X` unguarded, so a fields-less
   node crashed the whole article page; fixed with an early `if (!node.fields) return
   null;` in each.*
