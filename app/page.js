"use client";

import { useState, useEffect } from "react";

const LOADING_STEPS = [
  { icon: "📡", text: "देशभर से ताज़ा खबरें इकट्ठा कर रहे हैं..." },
  { icon: "🧠", text: "AI से ट्रेंड्स विश्लेषण कर रहे हैं..." },
  { icon: "🇮🇳", text: "हिंदी में आपके लिए तैयार कर रहे हैं..." },
];

const CATEGORIES = [
  { id: "all", label: "सभी", emoji: "🔥", color: "#FF4500" },
  { id: "खेल", label: "खेल", emoji: "🏏", color: "#3B82F6" },
  { id: "मनोरंजन", label: "मनोरंजन", emoji: "🎬", color: "#8B5CF6" },
  { id: "खबरें", label: "खबरें", emoji: "📰", color: "#EF4444" },
  { id: "स्थानीय", label: "स्थानीय", emoji: "📍", color: "#10B981" },
  { id: "त्योहार", label: "त्योहार", emoji: "🙏", color: "#F59E0B" },
  { id: "म्यूज़िक", label: "म्यूज़िक", emoji: "🎵", color: "#EC4899" },
  { id: "शिक्षा", label: "शिक्षा", emoji: "🎓", color: "#06B6D4" },
  { id: "टेक्नोलॉजी", label: "टेक", emoji: "💻", color: "#6366F1" },
];

function HeatBar({ score, size = "md" }) {
  const h = size === "lg" ? 8 : 5;
  const getColor = (s) => {
    if (s >= 90) return ["#FF4500", "#FF6B35"];
    if (s >= 80) return ["#FF6B35", "#FFA500"];
    if (s >= 70) return ["#FFA500", "#FFD700"];
    return ["#FFD700", "#90EE90"];
  };
  const [c1, c2] = getColor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: size === "lg" ? 120 : 80, height: h, borderRadius: h, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: h, background: `linear-gradient(90deg, ${c1}, ${c2})`, transition: "width 1s cubic-bezier(0.22, 1, 0.36, 1)", boxShadow: `0 0 ${size === "lg" ? 12 : 8}px ${c1}50` }} />
      </div>
      <span style={{ fontSize: size === "lg" ? 18 : 13, fontWeight: 800, color: c1, fontVariantNumeric: "tabular-nums" }}>{score}</span>
    </div>
  );
}

function VelocityBadge({ velocity, label }) {
  const config = {
    rapid_rise: { icon: "⚡", bg: "rgba(255,69,0,0.15)", border: "rgba(255,69,0,0.3)", color: "#FF6B35" },
    rising: { icon: "↑", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", color: "#10B981" },
    stable_high: { icon: "→", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)", color: "#60A5FA" },
  };
  const c = config[velocity] || config.rising;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: c.bg, border: `1px solid ${c.border}`, fontSize: 11, fontWeight: 600, color: c.color, whiteSpace: "nowrap" }}>
      {c.icon} {label}
    </span>
  );
}

function SignalChip({ signal }) {
  const colors = {
    "Google Trends": { bg: "#4285f41a", color: "#4285F4" },
    "GNews": { bg: "#ea43351a", color: "#EA4335" },
    "GoogleNews": { bg: "#34a8531a", color: "#34A853" },
    "News": { bg: "#ea43351a", color: "#EA4335" },
    "YouTube": { bg: "#ff00001a", color: "#FF0000" },
    "Social": { bg: "#1da1f21a", color: "#1DA1F2" },
    "GoogleNewsRSS": { bg: "#34a8531a", color: "#34A853" },
  };
  const c = colors[signal] || { bg: "#6b728015", color: "#9CA3AF" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 12, background: c.bg, border: `1px solid ${c.color}30`, fontSize: 10, fontWeight: 600, color: c.color }}>
      {signal}
    </span>
  );
}

function CategoryPill({ cat, isActive, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 24, background: isActive ? cat.color + "20" : "rgba(255,255,255,0.04)", border: `1.5px solid ${isActive ? cat.color + "60" : "rgba(255,255,255,0.08)"}`, color: isActive ? cat.color : "#9CA3AF", fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.25s ease", outline: "none", flexShrink: 0 }}>
      <span style={{ fontSize: 14 }}>{cat.emoji}</span>
      {cat.label}
    </button>
  );
}

function TrendCard({ trend, index, onClick, onCopy }) {
  const [hovered, setHovered] = useState(false);
  const isHero = index === 0;
  const catObj = CATEGORIES.find((c) => c.id === trend.category) || CATEGORIES[0];
  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: isHero ? `linear-gradient(135deg, ${catObj.color}12, ${catObj.color}06, rgba(20,20,28,0.95))` : "rgba(255,255,255,0.025)", border: `1px solid ${isHero ? catObj.color + "30" : "rgba(255,255,255,0.06)"}`, borderRadius: 20, padding: isHero ? "22px 20px" : "16px 18px", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.22, 1, 0.36, 1)", transform: hovered ? "translateY(-2px)" : "translateY(0)", boxShadow: hovered ? `0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px ${catObj.color}20` : "0 2px 8px rgba(0,0,0,0.1)", position: "relative", overflow: "hidden" }}>
      {isHero && <div style={{ position: "absolute", top: -60, right: -60, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${catObj.color}15, transparent 70%)`, pointerEvents: "none" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#4B5563", background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "2px 8px" }}>#{index + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: catObj.color, background: catObj.color + "15", borderRadius: 12, padding: "3px 10px", display: "flex", alignItems: "center", gap: 3 }}>{catObj.emoji} {trend.category}</span>
          <MovementBadge movement={trend.movement} />
        </div>
        <HeatBar score={trend.heat_score} size={isHero ? "lg" : "md"} />
      </div>
      <h3 style={{ fontSize: isHero ? 24 : 19, fontWeight: 800, color: "#F9FAFB", margin: "0 0 6px", lineHeight: 1.25 }}>
        <CopyableHashtag tag={trend.tag} onCopy={onCopy} style={{ color: "inherit" }} />
      </h3>
      <p style={{ fontSize: 14, color: "#B0B8C4", margin: "0 0 12px", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{trend.description}</p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <VelocityBadge velocity={trend.trend_velocity} label={trend.velocity_label} />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{(trend.signals || []).map((s) => <SignalChip key={s} signal={s} />)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 12, color: "#6B7280" }}>💬 {trend.discussing_count} लोग चर्चा कर रहे हैं</span>
        <span style={{ fontSize: 11, color: "#6B7280" }}>{trend.posted_time}</span>
      </div>
    </div>
  );
}

function TrendDetail({ trend, onBack, onCopy }) {
  const catObj = CATEGORIES.find((c) => c.id === trend.category) || CATEGORIES[0];
  const [showFull, setShowFull] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0C0D12", zIndex: 100, overflowY: "auto", WebkitOverflowScrolling: "touch", animation: "slideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "linear-gradient(180deg, #0C0D12 80%, transparent)", padding: "16px 18px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#E5E7EB", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}>←</button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: catObj.color, background: catObj.color + "15", borderRadius: 12, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 3 }}>{catObj.emoji} {trend.category}</span>
        </div>
        <HeatBar score={trend.heat_score} size="lg" />
      </div>
      <div style={{ padding: "0 18px 40px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#F9FAFB", margin: "0 0 6px", lineHeight: 1.15 }}>
          <CopyableHashtag tag={trend.tag} onCopy={onCopy} style={{ color: "inherit" }} />
        </h1>
        <p style={{ fontSize: 15, color: "#9CA3AF", margin: "0 0 6px", fontWeight: 500 }}>{trend.tagEn}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 20px", flexWrap: "wrap" }}>
          <VelocityBadge velocity={trend.trend_velocity} label={trend.velocity_label} />
          <span style={{ fontSize: 13, color: "#6B7280" }}>💬 {trend.discussing_count} लोग</span>
          <MovementBadge movement={trend.movement} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <WhatsAppShareButton trend={trend} />
        </div>
        <p style={{ fontSize: 16, color: "#D1D5DB", lineHeight: 1.65, margin: "0 0 24px" }}>{trend.description}</p>

        {trend.summary && (
          <div style={{ background: "linear-gradient(135deg, rgba(255,165,0,0.06), rgba(255,69,0,0.03))", border: "1px solid rgba(255,165,0,0.18)", borderRadius: 18, padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#FFA500", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 15 }}>✨</span> AI सारांश — यह क्यों ट्रेंड कर रहा है
            </div>
            <p style={{ fontSize: 15, color: "#E5E7EB", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>
              {showFull || trend.summary.length <= 220 ? trend.summary : trend.summary.substring(0, 220) + "..."}
            </p>
            {trend.summary.length > 220 && (
              <button onClick={(e) => { e.stopPropagation(); setShowFull(!showFull); }} style={{ background: "none", border: "none", color: "#FFA500", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: "10px 0 0", outline: "none" }}>
                {showFull ? "कम दिखाएं ↑" : "पूरा पढ़ें ↓"}
              </button>
            )}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>📡 सिग्नल स्रोत</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{(trend.signals || []).map((s) => <SignalChip key={s} signal={s} />)}</div>
        </div>

        {trend.content_preview && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>📎 संबंधित खबर</div>
            {trend.content_preview.url ? (
              <a href={trend.content_preview.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.08)", textDecoration: "none", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${catObj.color}40`; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#E5E7EB", marginBottom: 6, lineHeight: 1.4 }}>{trend.content_preview.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{trend.content_preview.source}</span>
                  <span style={{ fontSize: 12, color: catObj.color, fontWeight: 600 }}>पढ़ें ↗</span>
                </div>
              </a>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#E5E7EB", marginBottom: 6, lineHeight: 1.4 }}>{trend.content_preview.title}</div>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{trend.content_preview.source}</div>
              </div>
            )}
          </div>
        )}

        {trend.related_tags && trend.related_tags.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>🔗 संबंधित ट्रेंड</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {trend.related_tags.map((t) => (
                <span key={t} style={{ padding: "6px 14px", borderRadius: 16, background: catObj.color + "10", border: `1px solid ${catObj.color}25`, color: catObj.color, fontSize: 13, fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2000);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div style={{ position: "fixed", left: "50%", bottom: 30, transform: "translateX(-50%)", background: "rgba(20,20,28,0.95)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)", color: "#F9FAFB", padding: "10px 18px", borderRadius: 14, fontSize: 13, fontWeight: 600, zIndex: 200, animation: "toastIn 0.25s ease-out", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
      {message}
    </div>
  );
}

function CopyableHashtag({ tag, onCopy, style }) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(tag);
        onCopy(`हैशटैग कॉपी हो गया ✓`);
      }}
      title="कॉपी करें"
      style={{ cursor: "pointer", ...style }}
    >
      {tag}
    </span>
  );
}

function WhatsAppShareButton({ trend }) {
  const text = `🔥 ${trend.tag} ट्रेंडिंग है ShareChat पर!\n\n${trend.description}\n\nऔर ट्रेंड्स देखें: https://sharechat-trending.vercel.app`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 14, background: "linear-gradient(135deg, #25D366, #128C7E)", color: "white", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(37,211,102,0.3)", transition: "transform 0.15s ease" }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <span style={{ fontSize: 16 }}>💬</span> WhatsApp पर शेयर करें
    </a>
  );
}

function MovementBadge({ movement }) {
  if (!movement || movement === "same") return null;
  if (movement === "new") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 10, background: "linear-gradient(135deg, #FF4500, #FF6B35)", color: "white", fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", animation: "pulse 2s ease-in-out infinite" }}>
        ✨ नया
      </span>
    );
  }
  const isUp = movement.startsWith("up_");
  const n = parseInt(movement.split("_")[1], 10);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "2px 7px", borderRadius: 10, background: isUp ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.12)", color: isUp ? "#10B981" : "#EF4444", fontSize: 10, fontWeight: 800, border: `1px solid ${isUp ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.25)"}` }}>
      {isUp ? "↑" : "↓"}{n}
    </span>
  );
}

function LoadingNarrator() {
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStepIndex((i) => (i + 1) % LOADING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, []);
  const step = LOADING_STEPS[stepIndex];
  return (
    <div style={{ textAlign: "center", padding: "24px 20px 18px" }}>
      <div key={stepIndex} style={{ animation: "fadeStep 0.4s ease-out", display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 24, background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.18)" }}>
        <span style={{ fontSize: 18 }}>{step.icon}</span>
        <span style={{ fontSize: 13, color: "#E5E7EB", fontWeight: 500 }}>{step.text}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
        {LOADING_STEPS.map((_, i) => (
          <span key={i} style={{ width: i === stepIndex ? 20 : 6, height: 6, borderRadius: 3, background: i === stepIndex ? "#FFA500" : "rgba(255,255,255,0.15)", transition: "all 0.3s ease" }} />
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "0 14px" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "20px 18px", marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ width: 80, height: 20, borderRadius: 10, background: "rgba(255,255,255,0.06)" }} />
            <div style={{ width: 100, height: 16, borderRadius: 8, background: "rgba(255,255,255,0.06)" }} />
          </div>
          <div style={{ width: "70%", height: 22, borderRadius: 8, background: "rgba(255,255,255,0.06)", marginBottom: 8 }} />
          <div style={{ width: "100%", height: 16, borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 6 }} />
          <div style={{ width: "85%", height: 16, borderRadius: 8, background: "rgba(255,255,255,0.04)" }} />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (msg) => setToast({ msg, id: Date.now() });

  useEffect(() => { fetchTrends(); }, []);

  function computeMovement(currentTrends) {
    if (typeof window === "undefined") return currentTrends;
    let previous = [];
    try {
      previous = JSON.parse(localStorage.getItem("trendingPrevRanks") || "[]");
    } catch {}
    const prevRanks = new Map(previous.map((tag, i) => [tag, i + 1]));
    const annotated = currentTrends.map((t, i) => {
      const currentRank = i + 1;
      const prevRank = prevRanks.get(t.tag);
      let movement = "same";
      if (!prevRank) movement = "new";
      else if (prevRank > currentRank) movement = `up_${prevRank - currentRank}`;
      else if (prevRank < currentRank) movement = `down_${currentRank - prevRank}`;
      return { ...t, movement };
    });
    try {
      localStorage.setItem("trendingPrevRanks", JSON.stringify(currentTrends.map((t) => t.tag)));
    } catch {}
    return annotated;
  }

  async function fetchTrends() {
    if (trends.length > 0) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trends", { cache: "no-store" });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();
      const incoming = data.trends || [];
      const sorted = [...incoming].sort((a, b) => b.heat_score - a.heat_score);
      const withMovement = computeMovement(sorted);
      setTrends(withMovement);
      setMeta(data._meta || null);
      const now = new Date();
      const h = now.getHours() % 12 || 12;
      const m = String(now.getMinutes()).padStart(2, "0");
      setLastUpdated(`${h}:${m} ${now.getHours() >= 12 ? "PM" : "AM"}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredTrends = activeCategory === "all" ? trends : trends.filter((t) => t.category === activeCategory);
  const sortedTrends = [...filteredTrends].sort((a, b) => b.heat_score - a.heat_score);

  return (
    <div style={{ background: "#0C0D12", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0.8; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInCard { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeStep { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>

      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "linear-gradient(180deg, #0C0D12 0%, #0C0D12 85%, transparent 100%)", paddingBottom: 8 }}>
        <div style={{ padding: "16px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#F9FAFB", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: "linear-gradient(135deg, #FF4500, #FF6B35)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🔥 ट्रेंडिंग</span>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, fontWeight: 500 }}>भारत अभी किस बारे में बात कर रहा है</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {(() => {
              const status = loading ? "loading" : refreshing ? "refreshing" : meta?.source === "live" ? "live" : "demo";
              const dotColor = status === "live" ? "#10B981" : (status === "loading" || status === "refreshing") ? "#60A5FA" : "#F59E0B";
              const label = status === "live" ? "LIVE" : status === "loading" ? "\u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u093e \u0939\u0948" : status === "refreshing" ? "\u0905\u092a\u0921\u0947\u091f \u0939\u094b \u0930\u0939\u093e \u0939\u0948" : "DEMO";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "6px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, boxShadow: `0 0 8px ${dotColor}80`, animation: "pulse 2s ease-in-out infinite" }} />
                  <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{label}{status === "live" && lastUpdated && ` \u2022 ${lastUpdated}`}</span>
                </div>
              );
            })()}
            <button onClick={() => fetchTrends()} disabled={loading || refreshing} style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#9CA3AF", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", outline: "none", opacity: (loading || refreshing) ? 0.5 : 1 }}><span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>🔄</span></button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "8px 18px 4px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {CATEGORIES.map((cat) => <CategoryPill key={cat.id} cat={cat} isActive={activeCategory === cat.id} onClick={() => setActiveCategory(cat.id)} />)}
        </div>
      </div>

      <div style={{ padding: "8px 14px 30px" }}>
        {meta && (
          <div style={{ fontSize: 11, color: "#4B5563", padding: "0 4px 8px" }}>
            {meta.source === "live" ? `✅ लाइव — ${meta.articles_fetched} आर्टिकल्स से ${meta.trends_generated} ट्रेंड` : "⚠️ डेमो डेटा — API keys सेट करें लाइव ट्रेंड के लिए"}
            {meta.duration_ms && ` \u2022 ${(meta.duration_ms / 1000).toFixed(1)}s`}
          </div>
        )}

        {loading ? (
          <div>
            <LoadingNarrator />
            <LoadingSkeleton />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#EF4444" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, marginBottom: 8 }}>ट्रेंड लोड करने में समस्या</div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>{error}</div>
            <button onClick={fetchTrends} style={{ padding: "10px 24px", borderRadius: 12, background: "#FF4500", border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>फिर से कोशिश करें</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, padding: "0 4px 8px" }}>
              {sortedTrends.length} ट्रेंड मिले{activeCategory !== "all" && ` — ${CATEGORIES.find((c) => c.id === activeCategory)?.label}`}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sortedTrends.map((trend, index) => (
                <div key={trend.id || index} style={{ animation: `fadeInCard 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${index * 50}ms both` }}>
                  <TrendCard trend={trend} index={index} onClick={() => setSelectedTrend(trend)} onCopy={showToast} />
                </div>
              ))}
            </div>
            {sortedTrends.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#6B7280", fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>इस कैटेगरी में कोई ट्रेंड नहीं मिला
              </div>
            )}
          </>
        )}
        <div style={{ textAlign: "center", padding: "24px 16px 8px", fontSize: 11, color: "#4B5563", lineHeight: 1.6 }}>
          ShareChat Trending Tags<br />Powered by GNews · Google News · Gemini 2.5 Flash-Lite
        </div>
      </div>

      {selectedTrend && <TrendDetail trend={selectedTrend} onBack={() => setSelectedTrend(null)} onCopy={showToast} />}
      {toast && <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />}
    </div>
  );
}
