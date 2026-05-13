export const dynamic = "force-dynamic";
export const revalidate = 0;

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash";

// STEP 1: Collect raw signals

async function fetchGNewsHeadlines() {
  if (!GNEWS_API_KEY) {
    console.warn("GNEWS_API_KEY not set, skipping GNews");
    return [];
  }
  const categories = ["general", "sports", "entertainment", "technology", "business"];
  const results = [];
  for (const category of categories) {
    try {
      const url = `https://gnews.io/api/v4/top-headlines?category=${category}&country=in&lang=hi&max=5&apikey=${GNEWS_API_KEY}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.articles) {
        results.push(
          ...data.articles.map((a) => ({
            title: a.title,
            description: a.description || "",
            source: a.source?.name || "Unknown",
            category,
            url: a.url,
            publishedAt: a.publishedAt,
            origin: "GNews",
          }))
        );
      }
    } catch (err) {
      console.warn(`GNews ${category} error:`, err.message);
    }
  }
  return results;
}

async function fetchGoogleNewsRSS() {
  const feeds = [
    { url: "https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi", category: "general" },
    { url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0JXVnVMVWRDR0FBUAE?hl=hi&gl=IN&ceid=IN:hi", category: "sports" },
    { url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDR0FBUAE?hl=hi&gl=IN&ceid=IN:hi", category: "entertainment" },
  ];
  const results = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ShareChatTrending/1.0)" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 8)) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
        const sourceMatch = item.match(/<source.*?>(.*?)<\/source>/);
        if (titleMatch) {
          results.push({
            title: titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
            description: "",
            source: sourceMatch ? sourceMatch[1] : "Google News",
            category: feed.category,
            url: "",
            publishedAt: new Date().toISOString(),
            origin: "GoogleNewsRSS",
          });
        }
      }
    } catch (err) {
      console.warn("Google News RSS error:", err.message);
    }
  }
  return results;
}

// STEP 2: Process with Gemini

async function processWithGemini(rawArticles) {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not set");
    return null;
  }
  const uniqueArticles = rawArticles.reduce((acc, article) => {
    const isDuplicate = acc.some((a) => a.title.substring(0, 30) === article.title.substring(0, 30));
    if (!isDuplicate) acc.push(article);
    return acc;
  }, []);
  const articlesSummary = uniqueArticles
    .slice(0, 50)
    .map((a, i) => `${i + 1}. [${a.origin}/${a.category}] ${a.title} (Source: ${a.source})`)
    .join("\n");
  const today = new Date().toLocaleDateString("hi-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const prompt = `You are a trending topics engine for ShareChat, India's leading Hindi social media platform. Your audience is Hindi-speaking users across India — from metros (Mumbai, Delhi) to Tier 2+ cities (Lucknow, Patna, Indore, Jaipur).

Today's date: ${today}

Here are today's raw headlines from Indian news sources:

${articlesSummary}

TASK: Analyze these headlines and create 12-15 trending tags for the ShareChat feed.

RULES:
1. Cluster related headlines into single trends (e.g., multiple IPL articles = one #IPL trend)
2. Mix content: Bollywood, Cricket, National news, Regional news, Education, Festivals, Music — reflect what ALL of India talks about
3. Hashtags: Keep in English/Hinglish where that's the internet convention (#IPL2026, #SalmanKhan), use Hindi for culturally Hindi topics
4. Descriptions MUST be in colloquial Hindi — not formal translation. Write like a Hindi internet user would talk.
5. heat_score: 70-99 based on how many sources covered it and likely virality
6. Categories MUST be one of: खेल, मनोरंजन, खबरें, स्थानीय, त्योहार, म्यूज़िक, शिक्षा, टेक्नोलॉजी
7. trend_velocity: "rapid_rise" (breaking/new), "rising" (growing), "stable_high" (sustained discussion)

Return ONLY valid JSON (no markdown, no backticks) in this exact format:

{
  "generated_at": "ISO timestamp",
  "trends": [
    {
      "id": 1,
      "tag": "#HashTag",
      "tagEn": "#EnglishTag",
      "description": "Hindi description — colloquial, 1-2 lines",
      "category": "one of the categories above",
      "categoryEn": "English category name",
      "heat_score": 85,
      "signals": ["GNews", "GoogleNews"],
      "trend_velocity": "rising",
      "velocity_label": "बढ़ रहा है",
      "discussing_count": "X लाख or X हज़ार — estimate",
      "why_trending": [
        {"icon": "relevant emoji", "text": "Hindi reason 1"},
        {"icon": "relevant emoji", "text": "Hindi reason 2"},
        {"icon": "relevant emoji", "text": "Hindi reason 3"}
      ],
      "summary": "3-4 line Hindi summary of the trend — informative, colloquial",
      "related_tags": ["#tag1", "#tag2", "#tag3", "#tag4"],
      "posted_time": "X मिनट/घंटे पहले — estimate based on article times",
      "content_preview": {
        "type": "news/sports/entertainment/education",
        "title": "Most relevant article headline in Hindi",
        "source": "Source name"
      }
    }
  ]
}

velocity_label must be Hindi: "तेज़ी से बढ़ रहा" for rapid_rise, "बढ़ रहा है" for rising, "स्थिर — चर्चा में" for stable_high.

Return 12-15 trends, sorted by heat_score descending.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      console.error("Gemini API error:", res.status);
      return null;
    }
    const data = await res.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Gemini processing error:", err.message);
    return null;
  }
}

// STEP 3: Fallback

function getFallbackTrends() {
  return {
    generated_at: new Date().toISOString(),
    source: "fallback",
    trends: [
      {
        id: 1, tag: "#IPL2026", tagEn: "#IPL2026",
        description: "IPL 2026 सीज़न में आज का मैच — क्रिकेट फ़ैंस के बीच ज़बरदस्त excitement",
        category: "खेल", categoryEn: "Sports", heat_score: 95,
        signals: ["Google Trends", "News", "YouTube"], trend_velocity: "rapid_rise",
        velocity_label: "तेज़ी से बढ़ रहा", discussing_count: "5.2 लाख",
        why_trending: [
          { icon: "🏏", text: "आज IPL 2026 का बड़ा मुकाबला" },
          { icon: "📈", text: "सर्च वॉल्यूम +400% बढ़ा" },
          { icon: "💬", text: "सोशल मीडिया पर लाखों पोस्ट" }
        ],
        summary: "IPL 2026 सीज़न ज़ोरों पर है। आज के मैच में प्लेऑफ़ की दौड़ और रोमांचक हो गई है। फ़ैंस स्टेडियम और सोशल मीडिया पर पूरे जोश में हैं।",
        related_tags: ["#Cricket", "#ViratKohli", "#Dhoni", "#T20"],
        posted_time: "1 घंटा पहले",
        content_preview: { type: "sports", title: "आज का IPL मैच: पूरी जानकारी और प्लेइंग XI", source: "Cricbuzz Hindi" }
      },
      {
        id: 2, tag: "#Bollywood", tagEn: "#Bollywood",
        description: "बॉलीवुड की ताज़ा ख़बरें — नई फ़िल्मों के अपडेट और सेलेब्स की चर्चा",
        category: "मनोरंजन", categoryEn: "Entertainment", heat_score: 88,
        signals: ["YouTube", "Social", "News"], trend_velocity: "stable_high",
        velocity_label: "स्थिर — चर्चा में", discussing_count: "3.1 लाख",
        why_trending: [
          { icon: "🎬", text: "नई फ़िल्म का ट्रेलर रिलीज़" },
          { icon: "💬", text: "सेलेब्स सोशल मीडिया पर ट्रेंड में" },
          { icon: "🎥", text: "YouTube पर मिलियंस व्यूज़" }
        ],
        summary: "बॉलीवुड में आज कई बड़ी ख़बरें — नई फ़िल्मों के ट्रेलर, स्टार्स के इंटरव्यू और बॉक्स ऑफ़िस अपडेट्स पर चर्चा।",
        related_tags: ["#NewMovie", "#Trailer", "#BoxOffice", "#Celebrity"],
        posted_time: "2 घंटे पहले",
        content_preview: { type: "entertainment", title: "बॉलीवुड की आज की 5 सबसे बड़ी ख़बरें", source: "Filmfare Hindi" }
      },
      {
        id: 3, tag: "#BreakingNews", tagEn: "#BreakingNews",
        description: "देश की आज की सबसे बड़ी ख़बरें — ताज़ा अपडेट",
        category: "खबरें", categoryEn: "News", heat_score: 86,
        signals: ["News", "Google Trends"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "2.8 लाख",
        why_trending: [
          { icon: "📰", text: "राष्ट्रीय स्तर पर बड़ी ख़बर" },
          { icon: "📈", text: "सर्च में तेज़ी से बढ़ोतरी" },
          { icon: "💬", text: "सोशल मीडिया पर चर्चा" }
        ],
        summary: "देश भर से आज की सबसे अहम ख़बरें। राजनीति, अर्थव्यवस्था और समाज से जुड़े ताज़ा अपडेट।",
        related_tags: ["#India", "#Politics", "#Economy", "#Headlines"],
        posted_time: "30 मिनट पहले",
        content_preview: { type: "news", title: "आज की 10 बड़ी ख़बरें एक नज़र में", source: "NDTV India" }
      }
    ],
  };
}

// MAIN HANDLER

export async function GET(request) {
  const startTime = Date.now();
  try {
    const [gnewsArticles, googleNewsArticles] = await Promise.allSettled([
      fetchGNewsHeadlines(),
      fetchGoogleNewsRSS(),
    ]);
    const allArticles = [
      ...(gnewsArticles.status === "fulfilled" ? gnewsArticles.value : []),
      ...(googleNewsArticles.status === "fulfilled" ? googleNewsArticles.value : []),
    ];
    console.log(`Fetched ${allArticles.length} raw articles in ${Date.now() - startTime}ms`);
    if (allArticles.length === 0) {
      return Response.json({
        ...getFallbackTrends(),
        _meta: { source: "fallback", reason: "no_articles_fetched", duration_ms: Date.now() - startTime },
      });
    }
    const geminiResult = await processWithGemini(allArticles);
    if (geminiResult && geminiResult.trends && geminiResult.trends.length > 0) {
      geminiResult.trends = geminiResult.trends.map((t, i) => ({ ...t, id: i + 1 }));
      return Response.json({
        ...geminiResult,
        _meta: { source: "live", articles_fetched: allArticles.length, trends_generated: geminiResult.trends.length, duration_ms: Date.now() - startTime },
      });
    }
    return Response.json({
      ...getFallbackTrends(),
      _meta: { source: "fallback", reason: "gemini_failed", articles_fetched: allArticles.length, duration_ms: Date.now() - startTime },
    });
  } catch (err) {
    console.error("Trends API error:", err);
    return Response.json({
      ...getFallbackTrends(),
      _meta: { source: "fallback", reason: "exception", error: err.message, duration_ms: Date.now() - startTime },
    });
  }
}
