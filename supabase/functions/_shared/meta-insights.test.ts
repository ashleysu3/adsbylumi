// Tests for the Meta insights window/attribution helper.
// Run: deno test supabase/functions/_shared/meta-insights.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDateWindowParam,
  DEFAULT_DATE_PRESET,
  UNIFIED_ATTRIBUTION_PARAM,
} from "./meta-insights.ts";

Deno.test("a valid preset wins and is used verbatim", () => {
  assertEquals(buildDateWindowParam({ datePreset: "last_7d" }), "date_preset=last_7d");
  assertEquals(buildDateWindowParam({ datePreset: "today" }), "date_preset=today");
});

Deno.test("a valid preset beats explicit dates (preset is the account-tz source of truth)", () => {
  assertEquals(
    buildDateWindowParam({
      datePreset: "last_7d",
      dateRangeStart: "2026-07-01",
      dateRangeEnd: "2026-07-08",
    }),
    "date_preset=last_7d",
  );
});

Deno.test("an unknown preset is ignored (never interpolated raw into the URL)", () => {
  // Falls through to explicit dates when present...
  assertEquals(
    buildDateWindowParam({
      datePreset: "last_7d; DROP",
      dateRangeStart: "2026-07-01",
      dateRangeEnd: "2026-07-08",
    }),
    `time_range={"since":"2026-07-01","until":"2026-07-08"}`,
  );
  // ...or the safe default when there are none.
  assertEquals(
    buildDateWindowParam({ datePreset: "garbage" }),
    `date_preset=${DEFAULT_DATE_PRESET}`,
  );
});

Deno.test("explicit custom dates (no preset) produce a time_range", () => {
  assertEquals(
    buildDateWindowParam({ dateRangeStart: "2026-06-01", dateRangeEnd: "2026-06-30" }),
    `time_range={"since":"2026-06-01","until":"2026-06-30"}`,
  );
});

Deno.test("nothing supplied falls back to last_7d", () => {
  assertEquals(buildDateWindowParam({}), "date_preset=last_7d");
});

Deno.test("only one explicit date is not enough for a time_range", () => {
  assertEquals(buildDateWindowParam({ dateRangeStart: "2026-06-01" }), "date_preset=last_7d");
  assertEquals(buildDateWindowParam({ dateRangeEnd: "2026-06-30" }), "date_preset=last_7d");
});

Deno.test("attribution param is the unified setting", () => {
  assertEquals(UNIFIED_ATTRIBUTION_PARAM, "use_unified_attribution_setting=true");
});
