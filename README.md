# ShareChat Trending — APM Assignment

> A mobile-first trending tags engine for ShareChat that automatically surfaces what India is talking about right now — in colloquial Hindi.

🔗 **Live demo:** https://sharechat-trending.vercel.app
🎥 **Loom walkthrough:** _Add link before submission_
📦 **Repo:** https://github.com/ambikaam/sharechat-trending

---

## 1. Why this matters for ShareChat

Trending tags are not a discovery feature — they're a **daily-engagement loop**. For a Hindi-first user in a Tier 2+ city, opening ShareChat without an obvious "what's happening today" hook is the difference between a 30-second session and a 10-minute session. The product question I'm answering: _given no internal ShareChat data, can a small system reconstruct that hook from public signals — in Hindi, fresh on each open, and explainable to the user?_

## 2. How the system decides what's trending

```
   ┌──────────────────┐    ┌──────────────────┐
   │   GNews API      │    │  Google News RSS │
   │ 5 categories × 5 │    │  3 feeds × 8     │  ← parallel fetch, 5s timeouts each
   └────────┬─────────┘    └────────┬─────────┘
            │                       │
            └───────────┬───────────┘
                        ▼
              ┌──────────────────┐
              │  Dedupe (title)  │  ← collapse cross-source duplicates
              └────────┬─────────┘
                       ▼
        ┌──────────────────────────────┐
        │   Gemini 2.5 Flash-Lite      │  ← 25s timeout, thinkingBudget: 0
        │  • semantic clustering       │
        │  • category assignment       │
        │  • Hindi localization        │
        │  • heat score (70-99)        │
        │  • detailed AI summary       │     (covers what, why trending, impact)
        └──────────────┬───────────────┘
                       ▼
              ┌──────────────────────────┐
              │  URL validation          │  ← match preview title against
              │  (title-token overlap)   │     real GNews article URLs
              └──────────────┬───────────┘
                             ▼
              ┌──────────────────────────┐
              │  Gap-fill empty          │  ← top-up categories with <2
              │  categories from pool    │     trends, rotating every minute
              └──────────────┬───────────┘
                             ▼
              ┌──────────────────┐
              │ 10-12 ranked tags│  ← sorted by heat_score desc
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  React feed UI   │
              └──────────────────┘
```

**Fail-soft at every stage:** `Promise.allSettled` on signal collection, `AbortController` on every fetch, title-token URL validation (no fake URLs), per-category backup pool (40 curated trends) that gap-fills empty filters, and a schema-matched 12-trend full fallback if everything degrades. The UI never goes blank.

### Per-stage tech and why

| Stage | Tech | Why |
|---|---|---|
| Signal collection | **GNews** (India + `lang=hi`, 5 categories) | Free tier, Hindi-language headlines from real outlets, structured JSON. |
| Backup signal | **Google News RSS** (3 Hindi feeds) | No API key — resilience layer if GNews quota dies. Different source mix, different bias. |
| Clustering + scoring + localization | **Gemini 2.5 Flash-Lite** | One LLM call replaces three brittle services (clusterer + ranker + translator). `thinkingBudget: 0` disables the reasoning step for speed. Chose Lite over Flash for ~2× faster response (~8s vs ~17s) — clustering quality on Hindi news is still excellent at this prompt size. |
| Hosting | **Next.js App Router on Vercel** | Serverless API route + React in one repo, zero infra. `force-dynamic` ensures freshness on every open. |

### Scoring logic

The heat score (0–99) emitted per trend is a function of five weighted signals — these are documented in the Gemini prompt and reflected in the model's output:

| Signal | Weight | Rationale |
|---|---|---|
| **Source coverage** | 35% | If 8 outlets cover the same story, that's a real cultural moment, not a fluke. |
| **Recency** | 25% | A story breaking in the last 2 hours is more "trending" than one with the same coverage 18 hours ago. |
| **Source diversity** | 15% | One topic in 4 distinct outlets > same topic in 4 wires from one syndicator. |
| **Category balance** | 15% | Prevents an all-cricket-or-all-politics monoculture — ShareChat's feed serves all of India. |
| **Hindi/India relevance** | 10% | Explicit audience gate — a US election story is filtered down even if globally hot. |

### Filtering rules

- **Profanity & politically sensitive content** — blocked at the prompt level (the model is told ShareChat's audience norms).
- **Semantic duplicates** — handled by Gemini's clustering pass (e.g., "RCB beats CSK" + "Virat's masterclass" + "IPL thriller" → one `#RCBvsCSK` trend).
- **Low-confidence trends** — anything with only one source signal is deprioritized in scoring.
- **Evergreen tags** — `#Love`, `#Friends`, `#India` alone are deboosted; trends must reflect _today_.
- **Off-geography** — non-India trends filtered explicitly.

## 3. Localization philosophy

The single non-obvious decision: **don't translate hashtags, do translate context.**

- ❌ `#भारतबनामऑस्ट्रेलिया` — formally correct, no one searches it.
- ✅ `#INDvsAUS` + description: _"भारत-ऑस्ट्रेलिया मैच में रोमांचक मुक़ाबला, स्कोर देखें 🏏"_

Internet conventions (Roman hashtags) are preserved; descriptions and AI summaries are written in **colloquial Hindi** — the way a Lucknow college student would actually talk, not formal Doordarshan Hindi.

## 4. UX decisions

| Decision | Why |
|---|---|
| Cards in a vertical feed, not a list | Matches the social-app mental model users already have; lists feel like settings screens. |
| Heat as a color-graded bar, not a number | Scannable in 200ms. Most users won't read "87" — they'll read "orange." |
| Merged AI summary + reasoning into one panel | Algorithmic transparency without two competing blocks. The summary tells you *what's happening* AND *why it's trending* — single narrative, easier to read. |
| Pipeline-narrating loading state (📡 → 🧠 → 🇮🇳) | The wait is unavoidable (LLM call). Narrate the steps so it feels like progress, not lag. |
| Stale-while-revalidate on refresh | Pressing 🔄 doesn't blank the screen. Old trends stay visible with a small "अपडेट हो रहा है" indicator until new data arrives. |
| Trend movement badges (नया / ↑3 / ↓2) | The feed has memory. Movement vs. last load tells the user what's actually new — a real trending product, not a snapshot. Persisted in `localStorage`. |
| Tap-to-copy hashtag with toast | A user looking at `#IPL2026` wants to use it. Tap → clipboard → "हैशटैग कॉपी हो गया ✓". Designed for the next step. |
| WhatsApp share button on each trend | India's distribution layer is WhatsApp, not Twitter. Pre-filled share message respects how content actually moves in Tier 2+ cities. |
| Clickable source card with title-matched URL | Every "संबंधित खबर" is a real link to the source article from GNews — not a search fallback, not a fake URL. If we can't match, we hide the link cleanly. |
| Mobile width capped at 480px | The audience is on phones. A wide desktop layout would lie about the real experience. |
| Category pills are horizontally scrollable | More categories than fit on a 360px screen — scroll matches how Indian users navigate Instagram/Insta Reels. |

## 5. Tradeoffs made

| Chose | Over | Why |
|---|---|---|
| Serverless / per-open invocation | Streaming pipeline + cache | The brief asks for freshness, not 10ms latency. Build for 10–14 hours of effort, not 10K QPS. |
| One LLM for cluster+score+translate | Hand-rolled NLP + translation API | One call is more debuggable than three. Failure modes converge. |
| GNews + Google News only | Adding X/Twitter, Reddit, YouTube | Twitter/X scraping is unreliable; YouTube quota is real but adds engineering surface. Two well-handled sources beat five flaky ones. |
| Gemini 2.5 Flash-Lite | Flash (smarter, slower) or Pro (smartest, way slower) | Flash-Lite with `thinkingBudget: 0` hits the sweet spot: ~8s on Vercel free tier, well under the 60s function limit. Clustering quality at this prompt size is essentially equivalent to Flash. |
| Two-tier fallback: 40-trend category pool + 12-trend full fallback | Empty state or single placeholder | A user filtering to "त्योहार" on a slow news day should still see content. The 40-trend pool (5 per category) gap-fills empty categories with rotation; the 12-trend full fallback only fires if every API dies. UI looks identical whether live or filled. |

## 6. With 4 more weeks

1. **Personalization** — region (UP / Bihar / MH separate buckets), user category affinity, time-of-day patterns. Movement tracking is already client-side; this would move to server-side per user.
2. **More signal sources** — YouTube Trending IN, Reddit India, Cricbuzz RSS for cricket-specific spikes. The current pool-fill becomes less necessary as live coverage broadens.
3. **Creator amplification** — boost a trend if ShareChat creators are already posting on it (internal data hook).
4. **Trend lifecycle prediction** — "fading" / "just broke" classifications using the rank-movement signal we already track.
5. **A/B testing the card layout** — heat-bar-first vs description-first; track tap-through to detail view.
6. **Push notifications** — break-out trends (rapid_rise + heat ≥ 95) get a silent push.
7. **Real article rendering inside the card** — embed a snippet/image from the source, not just a link. (Current MVP keeps it as link to respect publisher traffic.)
8. **Offline / low-connectivity mode** — cache last successful invocation in IndexedDB for Tier 3 connectivity.

## 7. Project structure

```
app/
├── api/trends/
│   ├── route.js          # Pipeline: collect → dedupe → Gemini → validate URLs → gap-fill → JSON
│   └── pool.js           # 40-trend backup pool (5 per category × 8 categories) for gap-filling
├── page.js               # Feed + detail view + loading narrator + toast + movement tracking
└── layout.js             # Devanagari fonts, dark theme
```

---

_Built for the ShareChat APM assignment. Code, copy, scoring weights and UX decisions by Ambika Maheshwari._
