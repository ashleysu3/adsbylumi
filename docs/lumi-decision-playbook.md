# LUMI Decision Playbook

*The single source of truth for how LUMI reads Meta ad performance, what it recommends, and how it explains itself. Dashboard, weekly emails, and retrospectives are three views of one engine.*

**v0.2 · Locked defaults · 2026-04-30**

---

## 1. What this doc is

LUMI today has three surfaces that look at the same campaign data:

- **Performance dashboard** — the operator's everyday view ("what's happening right now?")
- **Weekly email report** — the operator's nudge ("the one thing to do this week")
- **Campaign retrospective** — the operator's debrief ("what did we learn at the end?")

This playbook defines the **single decision engine** all three call. They differ in **time window** and **depth**, not in **logic**. If a rule changes here, it changes everywhere automatically.

This doc is the canonical spec. Code is built from it; AI prompts reference it; updates happen here first, code second.

---

## 2. Time windows — the discipline

Every decision LUMI makes is framed against three windows:

| Window | Purpose |
|---|---|
| **Last 3 days** | Recent reaction. Did something break / spike yesterday? |
| **Last 7 days** | This week's pattern. Catches midweek-to-weekend swings. |
| **Last 30 days** | The longer trend. Smooths out noise. |

**The rule:** LUMI does not change a creative's status (see §5) on a single window alone. **Two of the three windows must agree.** This is the single biggest quality-of-life upgrade — it kills the "you turned off my best ad because of one bad Tuesday" complaint.

For retrospectives, the default is **lifetime** (or whatever the user picks in the setup dialog). The 3/7/30 rule applies to the dashboard + weekly report.

---

## 3. KPI taxonomy — primary AND secondary

Every campaign type has two KPIs. **Both display in every view.** The primary drives the goal; the secondary answers "but did it actually move the business?"

| Campaign type | Primary KPI | Secondary KPI |
|---|---|---|
| Lead Gen / Lead Form | Cost Per Lead (CPL) | **Purchases / revenue attributable** to those leads |
| Webinar Registration | Cost Per Lead (CPL) | **Sales after the webinar** |
| Discovery Call | Cost Per Booked Call | **Calls → sales conversion** |
| Email Capture | Cost Per Lead | (none — opt-in is the result) |
| Low-ticket / Sales | Cost Per Purchase or ROAS | **AOV + customer count** |
| High-ticket Sales | ROAS | **Customer count** |
| Traffic | Cost Per Click | **On-site conversion rate** (if pixel set) |
| Engagement / Reach | CPM | **Reach** |
| Video Views | Cost Per ThruPlay | (none — completion is the result) |

The secondary KPI doesn't change the primary judgment ("did we hit the goal") but it gives the user the full picture — "we hit the lead goal AND $X turned into customers" vs. "we hit the lead goal but nothing converted." Different stories. Both deserve airtime.

### 3.1 Attribution window for the secondary KPI

**Default:** 7-day click + 1-day view (Meta standard).
**Brand setting (advanced):** 28-day click for high-ticket offers (consideration cycle > 1 week).

Per-brand, not per-campaign. The consideration cycle is a brand reality, not a campaign reality.

---

## 4. The floors — when LUMI refuses to judge

Two thresholds below which LUMI won't make confident calls.

### 4.1 Reach floor — 1,000 unique people

If a creative has been seen by fewer than 1,000 unique people, LUMI will NOT recommend turning it off, scaling it, or marking it underperforming. Status = `learning`. Reasoning = "Still gathering reach — Meta is finding the audience."

### 4.2 Statistical floor — 30 conversions

If the campaign / adset / ad has fewer than 30 conversions in the relevant window, statistical comparison is unreliable. LUMI flags `confidence: low` on any decision and adds the note: "Below the threshold for confident comparison — read with caution."

For retrospectives, when total conversions < 10 OR total spend < $25, LUMI returns `data_quality: insufficient` and explicitly skips wins/underperformers/recommendations rather than inventing them.

---

## 5. Status taxonomy

Every ad / adset / campaign rolls up to one of seven statuses.

| Status | Meaning | Default action |
|---|---|---|
| `learning` | Reach < 1,000 OR < 7 days live. Too thin to judge. | Wait. Don't touch. |
| `scaling_ready` | Hitting goal × 0.9 in 2 of 3 windows + reach > 1,000 + 5+ days live. | Promote to scaling adset (ABO) OR add similar variants (CBO). |
| `performing` | Hitting goal in 2 of 3 windows but already in scaling adset. | Hold steady. |
| `promising` | Above goal but trending the right direction across windows. | Wait — give it more time. |
| `underperforming` | Above goal × 1.5 in both 3-day AND 7-day windows + reach > 1,000. | Turn off. |
| `fatigued` | CPL trending up 30%+ over 7-day vs prior 14-day AND frequency > 3 (cold) or > 5 (warm/retargeting). | Refresh creative. |
| `spend_starved` | Adset isn't fully spending its daily budget (avg < 85% of allocated) across 3+ days. | Push delivery / broaden / reduce. |

Status bubbles up: an adset's status is the worst of its non-`learning` ads. A campaign's status is the worst of its adsets.

---

## 6. The rules in if-then form

This is the canonical rule set. All thresholds locked from §3-§5.

### 6.1 Underperformer rule

```
IF reach >= 1000
   AND CPL_3day > goal × 1.5
   AND CPL_7day > goal × 1.5
THEN status = underperforming
     action = turn_off
     confidence = high (if both windows have ≥30 conversions) | medium (otherwise)
     reasoning = "Cost is consistently above your target across both 3-day and 7-day windows. Worth turning off and replacing."
```

### 6.2 Scaling-ready rule

```
IF reach >= 1000
   AND days_live >= 5
   AND CPL_3day <= goal × 0.9
   AND CPL_7day <= goal × 0.9
   AND adset_type = "testing"  # ABO only — see §6.8 for CBO variant
THEN status = scaling_ready
     action = promote_to_scaling
     confidence = high (if both windows have ≥30 conversions) | medium (otherwise)
     reasoning = "Hitting goal consistently in testing. Duplicate to scaling adset and turn off here. Note: scaling adset will reset Meta's learning, expect a few days of recalibration."
```

### 6.3 Performing-in-scaling rule

```
IF reach >= 1000
   AND CPL_3day <= goal
   AND CPL_7day <= goal
   AND adset_type = "scaling"
THEN status = performing
     action = hold
     reasoning = "Doing what you wanted it to. Hold steady."
```

### 6.4 Creative fatigue rule

```
IF reach >= 1000
   AND CPL_7day > CPL_14day_prior × 1.30
   AND ((audience_temperature = "cold" AND frequency > 3) OR
        (audience_temperature = "warm/retargeting" AND frequency > 5))
THEN status = fatigued
     action = refresh_creative
     confidence = high
     reasoning = "CPL has crept up [X]% over the last week vs. the week before. Frequency is over [3/5], meaning the same people are seeing this ad repeatedly. Time for fresh creative."
```

Audience temperature is detected from the adset's targeting configuration (custom audience = warm; saved/lookalike/broad = cold).

### 6.5 Spend-starved rule

```
IF adset_spend_3day_avg_daily < adset_daily_budget × 0.85
   AND ads_in_adset > 1
THEN status = spend_starved
     action = recommend (priority order: push_delivery if new creative present, else broaden_audience, else reduce_budget)
     confidence = high
     reasoning = "Meta hasn't been spending the full daily budget — averaging [X]% of [Y] across the last 3 days. Usually means audience is too narrow, the creative isn't winning the auction, or you've added new creative that Meta hasn't picked up. [Recommended action with explanation.]"
```

### 6.6 Promising rule

```
IF reach >= 1000
   AND CPL_3day < CPL_7day < CPL_14day  (improving trend)
   AND CPL_3day > goal  (still above goal)
THEN status = promising
     action = hold
     confidence = medium
     reasoning = "CPL is above goal but trending the right direction across windows. Give it 3-5 more days of spend before deciding."
```

### 6.7 Learning rule

```
IF reach < 1000 OR days_live < 7
THEN status = learning
     action = wait
     reasoning = "Not enough reach yet to make a confident call — Meta's still finding the audience. Check back in [X] days or when reach passes 1,000."
```

### 6.8 ABO vs CBO variant table

Detected from Meta's `is_skadnetwork_attribution` and `bid_strategy` fields plus campaign structure (whether budget is set at campaign or adset level).

| Rule | ABO action | CBO action |
|---|---|---|
| Underperformer | Turn off | Turn off |
| Fatigue | Refresh creative | Refresh creative |
| Scaling-ready | Promote to scaling adset | "Add 2-3 similar-style creatives — Meta is favoring [winner], give it more variants" |
| Spend-starved | Push delivery / broaden / reduce | Push delivery / broaden / reduce, with footer: "Consider switching to ABO if you want more control over budget allocation" |

Same brain (status taxonomy + KPI taxonomy + time windows). Different action language. Don't fork the rules engine; fork only the recommendation copy.

---

## 7. The decision engine API

A single edge function (`evaluate-campaign-status`) that everything calls. Server-only — no frontend mirror.

### Input

```ts
interface EvaluateInput {
  campaignId: string;       // Meta campaign id
  primaryKpi: string;       // 'cpl' | 'cpp' | 'roas' | 'cpc' | etc
  primaryGoal: number;
  primaryDirection: 'less_than' | 'greater_than';
  secondaryKpi?: string;
  attributionWindow?: '7d_click_1d_view' | '28d_click';  // defaults to 7d_click_1d_view
  asOf: string;             // ISO date — usually now(), but adjustable for retro
}
```

### Output

```ts
interface EvaluateOutput {
  campaign: AdEvaluation;
  adsets: AdEvaluation[];
  ads: AdEvaluation[];
  topRecommendation: AdEvaluation | null;  // for the weekly email's "one thing"
}

interface AdEvaluation {
  id: string;
  name: string;
  level: 'campaign' | 'adset' | 'ad';
  status: 'learning' | 'scaling_ready' | 'performing' | 'promising' | 'underperforming' | 'fatigued' | 'spend_starved';
  primary: { value: number | null; vsGoalPct: number | null; trendDirection: 'up' | 'down' | 'flat' };
  secondary: { value: number | null; label: string } | null;
  reach: number;
  daysLive: number;
  windows: {
    short: { spend: number; results: number; kpiValue: number | null };
    medium: { spend: number; results: number; kpiValue: number | null };
    long: { spend: number; results: number; kpiValue: number | null };
  };
  recommendation: {
    action: 'turn_off' | 'promote_to_scaling' | 'add_similar_variants' | 'increase_budget' | 'hold' | 'wait' | 'refresh_creative' | 'push_delivery' | 'broaden_audience' | 'reduce_budget';
    reasoning: string;       // plain-English, ready to display
    confidence: 'high' | 'medium' | 'low';
    impact: number;          // 0-100, used by the weekly email to pick "the one thing"
    impactReasoning: string; // why this is impactful (e.g. "saves ~$420/week at current spend")
  };
}
```

### How `topRecommendation` is picked (the weekly "one thing")

**Tiered priority — not pure impact × confidence.** This is deliberate: protective action beats offensive action when both are available.

1. **Spend-starved fixes** (campaigns leaking budget allocation)
2. **Underperformer turn-offs** (immediate cash savings)
3. **Fatigued creative refreshes** (mid-term health)
4. **Scaling-ready promotions** (forward momentum)

Within a tier, ties broken by `impact × confidence`. The single highest-priority recommendation across all campaigns/adsets/ads becomes `topRecommendation`. The weekly email shows just that one.

### How each surface uses the output

- **Performance dashboard:** renders all evaluations as status-tagged tiles. Color = status. Click → drill in.
- **Weekly email:** shows just `topRecommendation` with its reasoning, plus a 3-stat snapshot for context. One CTA.
- **Campaign retrospective:** runs evaluate at lifetime window. The status taxonomy informs the retrospective's "what worked / what underperformed" sections; specific bullets still come from the AI prompt.

---

## 8. Override + learning loop

When a user disagrees with LUMI's recommendation, capture it.

### 8.1 What to capture

```sql
CREATE TABLE recommendation_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id),
  ad_id text NOT NULL,
  recommendation_action text,
  user_action text,                -- 'kept_running' | 'turned_off_anyway' | 'modified'
  reason_quick text,               -- chip click: 'give_more_time' | 'trust_creative' | 'data_is_noisy' | 'other'
  reason_text text,                -- optional free-text
  created_at timestamptz DEFAULT now()
);
```

### 8.2 UX — inline chips, not a modal

When user dismisses a recommendation, show a small inline strip below the dismissed card:
`Why? [give it more time] [trust this creative] [data is noisy] [other] [skip]`

- Clickable chips, no required field.
- Skip is one click, never punishes.
- Tapping a chip records the reason and dismisses the card.

### 8.3 What it changes (Phase 1 — gather only)

For now, capture the data. Don't auto-adjust thresholds.

- **Snooze:** dismissed recommendations don't resurface for 5 days.
- **Surface in retrospectives:** "this brand has overridden underperformer flags on testimonial-format ads 4 times — pattern worth noting."

Auto-adjusting thresholds (e.g. raising this brand's underperformer multiplier from 1.5× to 1.7× after 5 overrides) is **Phase 2**, after we have 6+ months of override data per brand. Premature adjustment based on noise is worse than no adjustment.

---

## 9. Naming conventions (the data-quality piece)

LUMI generates the campaigns. So LUMI controls the names. Enforce a structured convention so retrospectives can extract patterns.

**Format:** `{YYYY-MM}_{Objective}_{AngleSlug}_{Format}_{Variant}`

**Example:** `2026-04_LeadGen_CuriosityHook_BRoll_v3`

**Why:** the retrospective AI can group by `AngleSlug` across all the brand's campaigns and say "your CuriosityHook angle has averaged $4.20 CPL across 6 campaigns; your TestimonialHook averaged $11.40." Useful pattern. Impossible without structured names.

This is an automation change — when LUMI's `build-meta-campaign` function names ads, it uses this convention. Existing user-named ads stay; new LUMI-built ones become queryable.

---

## 10. Plain-English language guide

For every recommendation, prefer:

| Don't say | Say |
|---|---|
| "CTR is below benchmark" | "Fewer people are clicking than usual" |
| "CPL is above goal by 47%" | "Each lead is costing $3 more than your target" |
| "Frequency is 4.2" | "The same people are seeing this ad about 4 times" |
| "This creative is fatigued" | "This ad is starting to wear out — your audience has seen it enough" |
| "The audience saturated" | "Meta's running out of new people to show this to" |
| "Algorithm in learning phase" | "Meta is still figuring out who responds best" |

System prompts everywhere should reference this table.

---

## 11. Push delivery — surfacing rule

Surfaced **only** when the spend-starved status fires AND there's at least one creative added in the last 7 days.

Recommendation copy: *"You added new creative [X days] ago but Meta isn't allocating budget to it. Try push delivery on [highest-CTR new creative] for 7 days to force budget there."*

Don't bury push delivery in advanced settings. Don't show it on every campaign. Show it precisely when the diagnostic fits — that turns a niche feature into a "LUMI just saved my afternoon" moment.

---

## 12. What this becomes (mapped to patches)

Order matters. Each builds on the last.

| Patch | Title | What it builds |
|---|---|---|
| **#28** | The brain | `evaluate-campaign-status` edge function. Implements all rules in §6. Returns the API in §7. No UI changes yet. Includes test cases for each rule. |
| **#29** | Performance dashboard rebuild | Single source of truth, primary + secondary KPIs in header, status badges from the engine, 3/7/30-day toggleable. |
| **#30** | Weekly email = "the one thing" | Calls engine, renders `topRecommendation`, plain-English email body, one CTA button. |
| **#31** | Retrospective wired to engine | Runs engine at lifetime scale. Secondary KPI in goal block + stats. Status taxonomy informs sections. |
| **#32** | Inline tooltips + plain-English everywhere | Tooltip components on all KPI labels. System prompts updated to reference §10. |
| **#33** | Override capture + snooze loop | New `recommendation_overrides` table. Inline chip UX. 5-day snooze. |
| **#34** | Naming convention enforcement | `build-meta-campaign` names ads using §9 format. |
| **#35** | "How LUMI thinks" page | Public-facing version of this playbook in plain English — builds trust by showing the work. |

---

## 13. How this playbook stays current

This doc lives at `docs/lumi-decision-playbook.md` in the repo. Versioned alongside code. When the rules change:

1. Edit the doc first.
2. Bump the version number at the top.
3. Patch follows from the doc, not the other way around.

Future-state: the playbook content is fed into LUMI's AI prompts (retrospective, recommendation engine) so the AI understands the same rules the engine does. That's a Patch #36+ enhancement once #28-#35 are stable.

---

## Changelog from v0.1

| Section | Change |
|---|---|
| §3.1 | Resolved attribution window — 7d_click + 1d_view default; 28d_click as brand-level override |
| §5 | Tightened status definitions; locked thresholds |
| §6 | All thresholds locked: underperformer 1.5×, scaling-ready 0.9×, fatigue 30% + frequency-by-temp |
| §6.4 | Added audience-temperature awareness (cold > 3, warm > 5) |
| §6.8 | New section: ABO vs CBO action variants |
| §7 | Locked tiered priority for `topRecommendation` (spend-starved > turn-offs > fatigue > scaling). Server-only function (no frontend mirror) |
| §8 | UX locked: inline chips, not modal. Phase 1 = gather only, no auto-adjust |
| §11 | New section: push delivery surfacing rule (contextual, not buried) |
| §12 | Patch order locked, #28–#35 mapped |
| §13 | New section: how the playbook stays current |
| Removed | "Open questions" section (§11 in v0.1) — all resolved into the locked rules above |

---

*v0.2 · Locked. Patch #28 builds from this.*
