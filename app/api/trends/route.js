export const dynamic = "force-dynamic";
export const revalidate = 0;

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-2.5-flash";

const GNEWS_CATEGORIES = ["general", "sports", "entertainment", "technology", "business"];
const GNEWS_PER_CATEGORY = 5;
const RSS_PER_FEED = 8;
const MAX_ARTICLES_TO_LLM = 25;
const GEMINI_TIMEOUT_MS = 25000;
const RSS_TIMEOUT_MS = 5000;
const GNEWS_TIMEOUT_MS = 5000;

// STEP 1: Collect raw signals

async function fetchGNewsCategory(category) {
  const url = `https://gnews.io/api/v4/top-headlines?category=${category}&country=in&lang=hi&max=${GNEWS_PER_CATEGORY}&apikey=${GNEWS_API_KEY}`;
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GNEWS_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const dt = Date.now() - t0;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`GNews ${category} HTTP ${res.status} in ${dt}ms — body: ${body.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    console.log(`GNews ${category} OK in ${dt}ms — ${data.articles?.length || 0} articles`);
    if (!data.articles) return [];
    return data.articles.map((a) => ({
      title: a.title,
      description: a.description || "",
      source: a.source?.name || "Unknown",
      category,
      url: a.url,
      publishedAt: a.publishedAt,
      origin: "GNews",
    }));
  } catch (err) {
    console.warn(`GNews ${category} ERROR in ${Date.now() - t0}ms:`, err.name, err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGNewsHeadlines() {
  if (!GNEWS_API_KEY) {
    console.warn("GNEWS_API_KEY not set, skipping GNews");
    return [];
  }
  const results = await Promise.all(GNEWS_CATEGORIES.map(fetchGNewsCategory));
  return results.flat();
}

const RSS_FEEDS = [
  { url: "https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi", category: "general" },
  { url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0JXVnVMVWRDR0FBUAE?hl=hi&gl=IN&ceid=IN:hi", category: "sports" },
  { url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0JXVnVMVWRDR0FBUAE?hl=hi&gl=IN&ceid=IN:hi", category: "entertainment" },
];

function decodeXmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

async function fetchRSSFeed(feed) {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShareChatTrending/1.0)" },
    });
    if (!res.ok) {
      console.warn(`RSS ${feed.category} HTTP ${res.status} in ${Date.now() - t0}ms`);
      return [];
    }
    console.log(`RSS ${feed.category} OK in ${Date.now() - t0}ms`);
    const text = await res.text();
    const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
    return items.slice(0, RSS_PER_FEED).reduce((acc, item) => {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      const sourceMatch = item.match(/<source.*?>(.*?)<\/source>/);
      if (titleMatch) {
        acc.push({
          title: decodeXmlEntities(titleMatch[1]),
          description: "",
          source: sourceMatch ? sourceMatch[1] : "Google News",
          category: feed.category,
          url: "",
          publishedAt: new Date().toISOString(),
          origin: "GoogleNewsRSS",
        });
      }
      return acc;
    }, []);
  } catch (err) {
    console.warn(`RSS ${feed.category} ERROR in ${Date.now() - t0}ms:`, err.name, err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoogleNewsRSS() {
  const results = await Promise.all(RSS_FEEDS.map(fetchRSSFeed));
  return results.flat();
}

// STEP 2: Process with Gemini

function dedupeArticles(articles) {
  return articles.reduce((acc, article) => {
    const key = article.title.substring(0, 30).toLowerCase();
    const isDuplicate = acc.some((a) => a.title.substring(0, 30).toLowerCase() === key);
    if (!isDuplicate) acc.push(article);
    return acc;
  }, []);
}

function buildPrompt(articles) {
  const today = new Date().toLocaleDateString("hi-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const articlesSummary = articles
    .map((a, i) => `${i + 1}. [${a.origin}/${a.category}] ${a.title} (Source: ${a.source})`)
    .join("\n");
  return `You are a trending topics engine for ShareChat, India's leading Hindi social media platform. Audience: Hindi-speaking users across India — from metros (Mumbai, Delhi) to Tier 2+ cities (Lucknow, Patna, Indore, Jaipur).

Today's date: ${today}

Today's raw headlines from Indian news sources:

${articlesSummary}

TASK: Create 10-12 trending tags for the ShareChat feed.

RULES:
1. Cluster related headlines into single trends (multiple IPL articles = one #IPL trend).
2. Mix content: Bollywood, Cricket, National news, Regional news, Education, Festivals, Music — reflect all of India.
3. Hashtags: keep English/Hinglish where internet-conventional (#IPL2026, #SalmanKhan); use Hindi for culturally Hindi topics.
4. Descriptions in colloquial Hindi — not formal translation.
5. heat_score: 70-99, based on source coverage and likely virality.
6. Categories MUST be one of: खेल, मनोरंजन, खबरें, स्थानीय, त्योहार, म्यूज़िक, शिक्षा, टेक्नोलॉजी.
7. trend_velocity: "rapid_rise" | "rising" | "stable_high".
8. velocity_label: "तेज़ी से बढ़ रहा" (rapid_rise) | "बढ़ रहा है" (rising) | "स्थिर — चर्चा में" (stable_high).

Return ONLY valid JSON (no markdown, no backticks):

{
  "generated_at": "ISO timestamp",
  "trends": [
    {
      "id": 1,
      "tag": "#HashTag",
      "tagEn": "#EnglishTag",
      "description": "Hindi description — colloquial, 1-2 lines",
      "category": "one of the categories",
      "categoryEn": "English category",
      "heat_score": 85,
      "signals": ["GNews", "GoogleNews"],
      "trend_velocity": "rising",
      "velocity_label": "बढ़ रहा है",
      "discussing_count": "X लाख or X हज़ार",
      "why_trending": [
        {"icon": "📰", "text": "Hindi reason 1"},
        {"icon": "📈", "text": "Hindi reason 2"},
        {"icon": "💬", "text": "Hindi reason 3"}
      ],
      "summary": "3-4 line Hindi summary — informative, colloquial",
      "related_tags": ["#tag1", "#tag2", "#tag3", "#tag4"],
      "posted_time": "X मिनट/घंटे पहले",
      "content_preview": {
        "type": "news/sports/entertainment/education",
        "title": "Most relevant Hindi article headline",
        "source": "Source name"
      }
    }
  ]
}

Sort by heat_score descending. Return 10-12 trends.`;
}

function repairTruncatedJSON(text) {
  const trendsStart = text.indexOf('"trends"');
  if (trendsStart === -1) return null;
  const arrayStart = text.indexOf("[", trendsStart);
  if (arrayStart === -1) return null;
  const complete = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;
  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { if (depth === 0) objStart = i; depth++; }
    else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try { complete.push(JSON.parse(text.slice(objStart, i + 1))); } catch {}
        objStart = -1;
      }
    }
  }
  if (complete.length === 0) return null;
  return { generated_at: new Date().toISOString(), trends: complete };
}

async function processWithGemini(rawArticles) {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not set");
    return null;
  }
  const articles = dedupeArticles(rawArticles).slice(0, MAX_ARTICLES_TO_LLM);
  const prompt = buildPrompt(articles);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      const repaired = repairTruncatedJSON(cleaned);
      if (repaired) {
        console.warn("Gemini JSON was truncated, repaired to", repaired.trends?.length, "complete trends");
        return repaired;
      }
      console.error("Gemini JSON parse failed:", parseErr.message);
      return null;
    }
  } catch (err) {
    console.error("Gemini processing error:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// STEP 3: Fallback (12 rich trends, schema-matched)

function getFallbackTrends() {
  return {
    generated_at: new Date().toISOString(),
    source: "fallback",
    trends: [
      {
        id: 1, tag: "#IPL2026", tagEn: "#IPL2026",
        description: "आज IPL का बड़ा मुक़ाबला — RCB vs CSK, फ़ैंस के बीच ज़बरदस्त excitement",
        category: "खेल", categoryEn: "Sports", heat_score: 97,
        signals: ["GNews", "GoogleNews"], trend_velocity: "rapid_rise",
        velocity_label: "तेज़ी से बढ़ रहा", discussing_count: "8.4 लाख",
        why_trending: [
          { icon: "🏏", text: "आज शाम बेंगलुरु में बड़ा मैच" },
          { icon: "📈", text: "सर्च वॉल्यूम +420% पिछले 3 घंटों में" },
          { icon: "💬", text: "12+ news outlets में कवरेज" },
        ],
        summary: "IPL 2026 का RCB vs CSK मैच आज सबसे ज़्यादा चर्चा में है। प्लेऑफ़ की रेस में दोनों टीमों के लिए यह मुक़ाबला निर्णायक होगा। विराट और धोनी की मौजूदगी से क्रेज़ और बढ़ गया है।",
        related_tags: ["#RCBvsCSK", "#ViratKohli", "#Dhoni", "#Cricket"],
        posted_time: "1 घंटा पहले",
        content_preview: { type: "sports", title: "RCB vs CSK Live: टॉस के बाद टीमें और पिच रिपोर्ट", source: "Cricbuzz Hindi" },
      },
      {
        id: 2, tag: "#SalmanKhan", tagEn: "#SalmanKhan",
        description: "सलमान खान की नई फ़िल्म 'सिकंदर' का ट्रेलर रिलीज़ — फ़ैंस में जोश",
        category: "मनोरंजन", categoryEn: "Entertainment", heat_score: 94,
        signals: ["GNews", "GoogleNews"], trend_velocity: "rapid_rise",
        velocity_label: "तेज़ी से बढ़ रहा", discussing_count: "6.2 लाख",
        why_trending: [
          { icon: "🎬", text: "सिकंदर का धमाकेदार ट्रेलर लॉन्च" },
          { icon: "▶️", text: "YouTube पर 24 घंटे में 50M+ व्यूज़" },
          { icon: "💬", text: "Eid 2026 की सबसे बड़ी रिलीज़" },
        ],
        summary: "सलमान खान की 'सिकंदर' का ट्रेलर आज जारी हुआ और चंद घंटों में सोशल मीडिया पर छा गया। ईद 2026 पर रिलीज़ हो रही इस फ़िल्म के एक्शन सीन और सलमान का लुक चर्चा का विषय हैं।",
        related_tags: ["#Sikandar", "#Eid2026", "#Bollywood", "#Trailer"],
        posted_time: "3 घंटे पहले",
        content_preview: { type: "entertainment", title: "Sikandar Trailer: सलमान का दमदार लुक, रिलीज़ डेट कन्फ़र्म", source: "Filmfare Hindi" },
      },
      {
        id: 3, tag: "#RBIRepoRate", tagEn: "#RBIRepoRate",
        description: "RBI ने repo rate में 25bps की कटौती की — होम लोन EMI घटेगी",
        category: "खबरें", categoryEn: "News", heat_score: 91,
        signals: ["GNews"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "4.1 लाख",
        why_trending: [
          { icon: "💰", text: "RBI ने 25bps की कटौती की" },
          { icon: "🏠", text: "होम लोन और कार लोन सस्ते होंगे" },
          { icon: "📈", text: "मार्केट और बैंकिंग स्टॉक्स में उछाल" },
        ],
        summary: "RBI ने आज MPC मीटिंग में repo rate 25 basis points घटाकर 6% कर दिया। इससे होम लोन, कार लोन और पर्सनल लोन की EMI में राहत मिलेगी। बैंकिंग और रियल एस्टेट स्टॉक्स में तेज़ी देखी जा रही है।",
        related_tags: ["#RBI", "#HomeLoan", "#Banking", "#Economy"],
        posted_time: "2 घंटे पहले",
        content_preview: { type: "news", title: "RBI Repo Rate Cut: आपकी EMI कितनी घटेगी? पूरा हिसाब", source: "Economic Times Hindi" },
      },
      {
        id: 4, tag: "#UPBoardResult", tagEn: "#UPBoardResult",
        description: "UP Board 10वीं-12वीं का रिज़ल्ट आज घोषित — upmsp.edu.in पर देखें",
        category: "शिक्षा", categoryEn: "Education", heat_score: 89,
        signals: ["GNews", "GoogleNews"], trend_velocity: "rapid_rise",
        velocity_label: "तेज़ी से बढ़ रहा", discussing_count: "12 लाख",
        why_trending: [
          { icon: "🎓", text: "55 लाख छात्रों का रिज़ल्ट आज" },
          { icon: "📊", text: "10वीं पास%: 89.5, 12वीं पास%: 82.1" },
          { icon: "🏆", text: "टॉपर्स की लिस्ट जारी" },
        ],
        summary: "UP Board ने आज दोपहर 2 बजे 10वीं और 12वीं का रिज़ल्ट जारी कर दिया। 55 लाख से ज़्यादा छात्रों ने एग्ज़ाम दिया था। upmsp.edu.in और results.upmsp.edu.in पर अपना रोल नंबर डालकर रिज़ल्ट देख सकते हैं।",
        related_tags: ["#UPBoard", "#Result2026", "#Education", "#10thResult"],
        posted_time: "30 मिनट पहले",
        content_preview: { type: "education", title: "UP Board Result 2026: ये रहा सीधा लिंक, टॉपर्स की लिस्ट", source: "Aaj Tak" },
      },
      {
        id: 5, tag: "#ArijitSingh", tagEn: "#ArijitSingh",
        description: "अरिजीत सिंह का नया रोमांटिक सॉन्ग रिलीज़ — Spotify पर ट्रेंडिंग #1",
        category: "म्यूज़िक", categoryEn: "Music", heat_score: 86,
        signals: ["GoogleNews"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "3.5 लाख",
        why_trending: [
          { icon: "🎵", text: "T-Series का नया रोमांटिक ट्रैक" },
          { icon: "📈", text: "Spotify India ट्रेंडिंग #1" },
          { icon: "🎬", text: "अगली फ़िल्म का म्यूज़िक" },
        ],
        summary: "अरिजीत सिंह का नया सॉन्ग आज रिलीज़ हुआ और Spotify India पर तुरंत ट्रेंडिंग #1 पर पहुँच गया। रोमांटिक मेलोडी और गहरे लिरिक्स की वजह से रील्स पर भी तेज़ी से वायरल हो रहा है।",
        related_tags: ["#NewSong", "#Bollywood", "#Music", "#Spotify"],
        posted_time: "5 घंटे पहले",
        content_preview: { type: "entertainment", title: "Arijit Singh का नया गाना: सुनते ही दिल को छू जाएगा", source: "T-Series" },
      },
      {
        id: 6, tag: "#PetrolPrice", tagEn: "#PetrolPrice",
        description: "पेट्रोल-डीज़ल के दाम में ₹2 की कटौती — आज से लागू",
        category: "खबरें", categoryEn: "News", heat_score: 84,
        signals: ["GNews"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "2.7 लाख",
        why_trending: [
          { icon: "⛽", text: "पेट्रोल-डीज़ल ₹2 सस्ता हुआ" },
          { icon: "📍", text: "सभी राज्यों में नए रेट लागू" },
          { icon: "💬", text: "आम जनता को राहत" },
        ],
        summary: "ऑयल कंपनियों ने आज पेट्रोल और डीज़ल के दाम में प्रति लीटर ₹2 की कटौती की। यह कटौती आज सुबह 6 बजे से लागू हो गई। दिल्ली में पेट्रोल ₹94.72 और डीज़ल ₹87.62 प्रति लीटर पर मिल रहा है।",
        related_tags: ["#FuelPrice", "#Petrol", "#Diesel", "#Economy"],
        posted_time: "4 घंटे पहले",
        content_preview: { type: "news", title: "Petrol-Diesel Price: आपके शहर में आज का रेट", source: "NDTV India" },
      },
      {
        id: 7, tag: "#ShraddhaKapoor", tagEn: "#ShraddhaKapoor",
        description: "श्रद्धा कपूर ने इंस्टा पर बनाया रिकॉर्ड — 100M followers पार",
        category: "मनोरंजन", categoryEn: "Entertainment", heat_score: 82,
        signals: ["GoogleNews"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "2.2 लाख",
        why_trending: [
          { icon: "📸", text: "Instagram पर 100M+ followers" },
          { icon: "🌟", text: "ये करने वाली तीसरी भारतीय एक्ट्रेस" },
          { icon: "🎬", text: "अगली फ़िल्म स्त्री 3 की अनाउंसमेंट" },
        ],
        summary: "श्रद्धा कपूर ने Instagram पर 100 मिलियन followers का आँकड़ा पार कर लिया है। यह कमाल करने वाली वे तीसरी भारतीय एक्ट्रेस बन गई हैं। स्त्री 3 की अनाउंसमेंट के बाद से उनकी popularity और बढ़ी है।",
        related_tags: ["#Stree3", "#Instagram", "#Bollywood", "#100M"],
        posted_time: "6 घंटे पहले",
        content_preview: { type: "entertainment", title: "Shraddha Kapoor: 100M followers क्लब में शामिल", source: "Pinkvilla" },
      },
      {
        id: 8, tag: "#GuruPurnima", tagEn: "#GuruPurnima",
        description: "गुरु पूर्णिमा आज — मंदिरों में भक्तों की भीड़, सोशल मीडिया पर शुभकामनाएँ",
        category: "त्योहार", categoryEn: "Festival", heat_score: 80,
        signals: ["GNews", "GoogleNews"], trend_velocity: "stable_high",
        velocity_label: "स्थिर — चर्चा में", discussing_count: "9 लाख",
        why_trending: [
          { icon: "🙏", text: "देशभर के मंदिरों में विशेष पूजा" },
          { icon: "💬", text: "WhatsApp पर शुभकामनाओं की बाढ़" },
          { icon: "🌸", text: "गुरुओं के सम्मान का पर्व" },
        ],
        summary: "आज पूरे देश में गुरु पूर्णिमा का पावन पर्व मनाया जा रहा है। मंदिरों, आश्रमों और शिक्षण संस्थानों में विशेष पूजा-अर्चना हो रही है। सोशल मीडिया पर गुरुओं को सम्मान देने वाले मैसेज और कोट्स ट्रेंड कर रहे हैं।",
        related_tags: ["#Festival", "#Spiritual", "#India", "#Tradition"],
        posted_time: "8 घंटे पहले",
        content_preview: { type: "news", title: "Guru Purnima 2026: शुभ मुहूर्त, पूजा विधि और महत्व", source: "Dainik Jagran" },
      },
      {
        id: 9, tag: "#MumbaiRains", tagEn: "#MumbaiRains",
        description: "मुंबई में मूसलाधार बारिश — लोकल ट्रेनें प्रभावित, रेड अलर्ट जारी",
        category: "स्थानीय", categoryEn: "Local", heat_score: 78,
        signals: ["GNews", "GoogleNews"], trend_velocity: "rapid_rise",
        velocity_label: "तेज़ी से बढ़ रहा", discussing_count: "5.8 लाख",
        why_trending: [
          { icon: "🌧️", text: "24 घंटे में 200mm+ बारिश" },
          { icon: "🚆", text: "लोकल ट्रेन सर्विस प्रभावित" },
          { icon: "⚠️", text: "IMD ने रेड अलर्ट जारी किया" },
        ],
        summary: "मुंबई में पिछले 24 घंटों में रिकॉर्ड बारिश दर्ज की गई है। कई इलाक़ों में जलभराव, लोकल ट्रेनें देर से चल रही हैं। BMC ने स्कूल बंद करने का आदेश दिया है। IMD ने अगले 48 घंटों के लिए रेड अलर्ट जारी किया है।",
        related_tags: ["#Mumbai", "#Monsoon", "#Weather", "#RedAlert"],
        posted_time: "45 मिनट पहले",
        content_preview: { type: "news", title: "Mumbai Rains Live: कहाँ-कहाँ जलभराव, ट्रेन अपडेट", source: "Mumbai Mirror" },
      },
      {
        id: 10, tag: "#SarkariNaukri", tagEn: "#SarkariNaukri",
        description: "रेलवे में 25,000 पदों पर भर्ती — आवेदन की लास्ट डेट जल्द",
        category: "शिक्षा", categoryEn: "Education", heat_score: 76,
        signals: ["GoogleNews"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "7.3 लाख",
        why_trending: [
          { icon: "🚂", text: "रेलवे ग्रुप D में 25K वैकेंसी" },
          { icon: "📝", text: "ऑनलाइन आवेदन शुरू" },
          { icon: "📅", text: "लास्ट डेट: 30 तारीख" },
        ],
        summary: "Indian Railways ने ग्रुप D के 25,000 पदों के लिए notification जारी किया है। 10वीं पास युवा आवेदन कर सकते हैं। rrbcdg.gov.in पर ऑनलाइन फॉर्म भरा जा सकता है। उत्तर प्रदेश और बिहार के युवाओं में सबसे ज़्यादा क्रेज़ है।",
        related_tags: ["#Railway", "#GovtJobs", "#RRB", "#Recruitment"],
        posted_time: "10 घंटे पहले",
        content_preview: { type: "education", title: "Railway Group D Vacancy 2026: कैसे करें apply", source: "Sarkari Result" },
      },
      {
        id: 11, tag: "#iPhone17", tagEn: "#iPhone17",
        description: "iPhone 17 का इंडिया लॉन्च कन्फ़र्म — कीमत और फ़ीचर्स लीक",
        category: "टेक्नोलॉजी", categoryEn: "Technology", heat_score: 74,
        signals: ["GNews"], trend_velocity: "rising",
        velocity_label: "बढ़ रहा है", discussing_count: "1.9 लाख",
        why_trending: [
          { icon: "📱", text: "Apple ने इंडिया लॉन्च डेट कन्फ़र्म की" },
          { icon: "💸", text: "स्टार्टिंग प्राइस ₹79,900 लीक" },
          { icon: "📸", text: "नया कैमरा सिस्टम — 5x ज़ूम" },
        ],
        summary: "Apple ने iPhone 17 की भारत में लॉन्च डेट कन्फ़र्म कर दी है। लीक्स के मुताबिक स्टैंडर्ड मॉडल की कीमत ₹79,900 से शुरू होगी। टाइटेनियम बॉडी, A19 चिप और बेहतर कैमरा सिस्टम मुख्य आकर्षण हैं।",
        related_tags: ["#Apple", "#iPhone", "#Tech", "#Launch"],
        posted_time: "7 घंटे पहले",
        content_preview: { type: "news", title: "iPhone 17 India Price: सबसे सस्ता और महंगा मॉडल", source: "Gadgets360 Hindi" },
      },
      {
        id: 12, tag: "#KaunBanegaCrorepati", tagEn: "#KBC16",
        description: "KBC 16 का नया एपिसोड — ₹1 करोड़ जीतने वाले कंटेस्टेंट की कहानी",
        category: "मनोरंजन", categoryEn: "Entertainment", heat_score: 72,
        signals: ["GoogleNews"], trend_velocity: "stable_high",
        velocity_label: "स्थिर — चर्चा में", discussing_count: "1.4 लाख",
        why_trending: [
          { icon: "💰", text: "बिहार के टीचर ने जीते ₹1 करोड़" },
          { icon: "🎬", text: "Sony TV का सबसे popular शो" },
          { icon: "❤️", text: "अमिताभ बच्चन की होस्टिंग वायरल" },
        ],
        summary: "कौन बनेगा करोड़पति 16 के कल के एपिसोड में बिहार के एक स्कूल टीचर ने ₹1 करोड़ जीते। उनकी प्रेरणादायक कहानी और अमिताभ बच्चन के साथ इमोशनल पल सोशल मीडिया पर ख़ूब वायरल हो रहे हैं।",
        related_tags: ["#KBC", "#AmitabhBachchan", "#SonyTV", "#GameShow"],
        posted_time: "12 घंटे पहले",
        content_preview: { type: "entertainment", title: "KBC 16: बिहार के टीचर ने रचा इतिहास, जीते ₹1 करोड़", source: "Sony Entertainment" },
      },
    ],
  };
}

// MAIN HANDLER

export async function GET() {
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
    const gnewsCount = gnewsArticles.status === "fulfilled" ? gnewsArticles.value.length : 0;
    const rssCount = googleNewsArticles.status === "fulfilled" ? googleNewsArticles.value.length : 0;
    const gnewsKeyInfo = GNEWS_API_KEY ? `set(len=${GNEWS_API_KEY.length})` : "MISSING";
    const geminiKeyInfo = GEMINI_API_KEY ? `set(len=${GEMINI_API_KEY.length})` : "MISSING";
    if (gnewsArticles.status === "rejected") console.error("GNews promise rejected:", gnewsArticles.reason);
    if (googleNewsArticles.status === "rejected") console.error("RSS promise rejected:", googleNewsArticles.reason);
    console.log(`Fetched ${allArticles.length} raw articles in ${Date.now() - startTime}ms (GNews: ${gnewsCount}, RSS: ${rssCount}, GNEWS_KEY: ${gnewsKeyInfo}, GEMINI_KEY: ${geminiKeyInfo})`);

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
        _meta: {
          source: "live",
          articles_fetched: allArticles.length,
          trends_generated: geminiResult.trends.length,
          duration_ms: Date.now() - startTime,
        },
      });
    }

    return Response.json({
      ...getFallbackTrends(),
      _meta: {
        source: "fallback",
        reason: "gemini_failed",
        articles_fetched: allArticles.length,
        duration_ms: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error("Trends API error:", err);
    return Response.json({
      ...getFallbackTrends(),
      _meta: { source: "fallback", reason: "exception", error: err.message, duration_ms: Date.now() - startTime },
    });
  }
}
