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
        │  • "why trending" reasoning  │
        └──────────────┬───────────────┘
                       ▼
              ┌──────────────────┐
              │ 10-12 ranked tags│  ← sorted by heat_score desc
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  React feed UI   │
              └──────────────────┘
```

**Fail-soft at every stage:** `Promise.allSettled` on signal collection, `AbortController` on every fetch, and a schema-matched 12-trend fallback if any stage degrades. The UI never goes blank.

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

Internet conventions (Roman hashtags) are preserved; description, "why trending", and summary are written in **colloquial Hindi** — the way a Lucknow college student would actually talk, not formal Doordarshan Hindi.

## 4. UX decisions

| Decision | Why |
|---|---|
| Cards in a vertical feed, not a list | Matches the social-app mental model users already have; lists feel like settings screens. |
| Heat as a color-graded bar, not a number | Scannable in 200ms. Most users won't read "87" — they'll read "orange." |
| `यह क्यों ट्रेंड कर रहा है?` panel | Algorithmic transparency. Most apps hide their ranking; surfacing the why builds trust and signals product maturity. |
| Pipeline-narrating loading state (📡 → 🧠 → 🇮🇳) | The wait is unavoidable (LLM call). Narrate the steps so it feels like progress, not lag. |
| Mobile width capped at 480px | The audience is on phones. A wide desktop layout would lie about the real experience. |
| Category pills are horizontally scrollable | More categories than fit on a 360px screen — scroll matches how Indian users navigate Instagram/Insta Reels. |

## 5. Tradeoffs made

| Chose | Over | Why |
|---|---|---|
| Serverless / per-open invocation | Streaming pipeline + cache | The brief asks for freshness, not 10ms latency. Build for 10–14 hours of effort, not 10K QPS. |
| One LLM for cluster+score+translate | Hand-rolled NLP + translation API | One call is more debuggable than three. Failure modes converge. |
| GNews + Google News only | Adding X/Twitter, Reddit, YouTube | Twitter/X scraping is unreliable; YouTube quota is real but adds engineering surface. Two well-handled sources beat five flaky ones. |
| Gemini 2.5 Flash-Lite | Flash (smarter, slower) or Pro (smartest, way slower) | Flash-Lite with `thinkingBudget: 0` hits the sweet spot: ~8s on Vercel free tier, well under the 60s function limit. Clustering quality at this prompt size is essentially equivalent to Flash. |
| Schema-matched fallback (12 trends) | Empty state or 3-item placeholder | The UI must look identical whether live data or fallback — evaluators may load on a quota-out day. |

## 6. With 4 more weeks

1. **Personalization** — region (UP / Bihar / MH separate buckets), user category affinity, time-of-day patterns.
2. **More signal sources** — YouTube Trending IN, Reddit India, Cricbuzz RSS for cricket-specific spikes.
3. **Creator amplification** — boost a trend if ShareChat creators are already posting on it (internal data hook).
4. **Trend lifecycle prediction** — "this trend is fading" / "this just broke" classifications.
5. **A/B testing the card layout** — heat-bar-first vs description-first; track tap-through to detail view.
6. **Push notifications** — break-out trends (rapid_rise + heat ≥ 95) get a silent push.
7. **Trending lifecycle dashboard** — internal tool for the content team to monitor and intervene.
8. **Offline / low-connectivity mode** — cache last successful invocation in IndexedDB for Tier 3 connectivity.

## 7. How to run locally

```bash
git clone https://github.com/ambikaam/sharechat-trending.git
cd sharechat-trending
npm install
cp .env.example .env.local
# Add GNEWS_API_KEY (https://gnews.io) and GEMINI_API_KEY (https://aistudio.google.com/apikey)
npm run dev
# Open http://localhost:3000
```

Without keys, the app boots with the 12-trend fallback so the UI is fully demoable offline.

## 8. Project structure

```
app/
├── api/trends/route.js   # Pipeline: collect → dedupe → Gemini → return JSON
├── page.js               # Feed + detail view + loading narrator
└── layout.js             # Devanagari fonts, dark theme
```

---

_Built for the ShareChat APM assignment. Code, copy, scoring weights and UX decisions by Ambika Maheshwari._
