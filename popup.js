const EMOTION_COLORS = {
  "Curiosity":     "#7a9e8e",
  "Inspiration":   "#c4956a",
  "To think":      "#7b8fa8",
  "Calm":          "#8eaa8e",
  "Avoiding work": "#b07070",
  "Validation":    "#a08ab0",
  "Loneliness":    "#7090a8",
  "Habit":         "#9a9a8a"
};

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

function formatTime(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffH = diffMs / (1000 * 60 * 60);
  const diffD = diffMs / (1000 * 60 * 60 * 24);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffD < 2) return "yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInsight(entries) {
  if (entries.length < 3) return null;
  const recent = entries.slice(-20);
  const counts = {};
  recent.forEach(e => { counts[e.reason] = (counts[e.reason] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const lateNight = recent.filter(e => { const h = new Date(e.timestamp).getHours(); return h >= 22 || h <= 4; });
  const afternoons = recent.filter(e => { const h = new Date(e.timestamp).getHours(); return h >= 13 && h <= 17; });
  const totalThisWeek = entries.filter(e => (Date.now() - new Date(e.timestamp)) < 7 * 24 * 60 * 60 * 1000).length;
  const insights = [];
  if (lateNight.length >= 2) {
    const lnC = {}; lateNight.forEach(e => { lnC[e.reason] = (lnC[e.reason]||0)+1; });
    const lnTop = Object.entries(lnC).sort((a,b)=>b[1]-a[1])[0][0];
    insights.push(`"${lnTop}" appears most often late at night.`);
  }
  if (afternoons.length >= 2) {
    const afC = {}; afternoons.forEach(e => { afC[e.reason] = (afC[e.reason]||0)+1; });
    const afTop = Object.entries(afC).sort((a,b)=>b[1]-a[1])[0][0];
    insights.push(`"${afTop}" tends to peak in the afternoon.`);
  }
  if (top[1] >= 3) insights.push(`You've opened Substack from "${top[0]}" ${top[1]} times recently.`);
  if (totalThisWeek >= 7) insights.push(`${totalThisWeek} sessions this week. That's more than once a day.`);
  if (insights.length === 0) insights.push(`Your most common intent lately: "${top[0]}".`);
  return insights[Math.floor(Math.random() * insights.length)];
}

function getThisWeekCount(entries) {
  return entries.filter(e => (Date.now() - new Date(e.timestamp)) < 7 * 24 * 60 * 60 * 1000).length;
}
function getTodayCount(entries) {
  const today = new Date().toDateString();
  return entries.filter(e => new Date(e.timestamp).toDateString() === today).length;
}
function getTopEmotions(entries) {
  const recent = entries.slice(-50);
  const counts = {};
  recent.forEach(e => { counts[e.reason] = (counts[e.reason] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function renderEmpty() {
  return `
    <div class="header">
      <div class="header-left">
        <div class="logo-mark">
          <svg viewBox="0 0 32 20" width="22" height="14">
            <path d="M2 14 Q7 4 12 14 Q17 24 22 14 Q27 4 30 14" fill="none" stroke="#7a7268" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="brand-name">Ground Floor</span>
      </div>
    </div>
    <div class="empty-state">
      <div class="empty-wave">
        <svg viewBox="0 0 60 30" width="52" height="26">
          <path d="M4 20 Q11 6 18 20 Q25 34 32 20 Q39 6 46 20 Q53 34 58 20" fill="none" stroke="#a09a90" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="empty-title">No entries yet.</div>
      <div class="empty-sub">Open Substack and choose<br>how you're arriving today.</div>
    </div>`;
}

function renderDashboard(entries) {
  const insight = getInsight(entries);
  const weekCount = getThisWeekCount(entries);
  const todayCount = getTodayCount(entries);
  const totalCount = entries.length;
  const topEmotions = getTopEmotions(entries);
  const maxCount = topEmotions.length > 0 ? topEmotions[0][1] : 1;
  const recent = entries.slice(-5).reverse();

  const emotionBarsHTML = topEmotions.map(([emotion, count]) => {
    const pct = Math.round((count / maxCount) * 100);
    const color = EMOTION_COLORS[emotion] || "#8b7d6b";
    return `<div class="emotion-row">
      <span class="emotion-name">${emotion}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="emotion-count">${count}</span>
    </div>`;
  }).join("");

  const recentHTML = recent.map(e => `
    <div class="entry-row">
      <span class="entry-emotion">${e.reason}</span>
      <span class="entry-time">${formatTime(e.timestamp)}</span>
    </div>`).join("");

  return `
    <div class="header">
      <div class="header-left">
        <div class="logo-mark">
          <svg viewBox="0 0 32 20" width="22" height="14">
            <path d="M2 14 Q7 4 12 14 Q17 24 22 14 Q27 4 30 14" fill="none" stroke="#7a7268" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="brand-name">Ground Floor</span>
      </div>
      <button id="gf-open-full" class="open-full">Full view ↗</button>
    </div>

    <div class="week-summary">
      <div class="week-label">At a glance</div>
      <div class="week-stats">
        <div class="stat-block"><div class="stat-number">${todayCount}</div><div class="stat-desc">today</div></div>
        <div class="stat-block"><div class="stat-number">${weekCount}</div><div class="stat-desc">this week</div></div>
        <div class="stat-block"><div class="stat-number">${totalCount}</div><div class="stat-desc">all time</div></div>
      </div>
    </div>

    ${insight ? `<div class="insight"><div class="insight-label">Pattern</div><div class="insight-text">${insight}</div></div>` : ""}

    <div class="section">
      <div class="section-label">Top emotions</div>
      <div class="emotion-bars">${emotionBarsHTML}</div>
    </div>

    <div class="recent-entries">
      <div class="section-label">Recent</div>
      ${recentHTML}
    </div>

    <div class="popup-footer">
      <button id="gf-open-footer" class="footer-link">Open full dashboard + Notes Analytics →</button>
    </div>`;
}

// Boot
chrome.storage.local.get(["gf_entries"], (result) => {
  const entries = result.gf_entries || [];
  const app = document.getElementById("app");
  app.innerHTML = entries.length === 0 ? renderEmpty() : renderDashboard(entries);

  // Wire dashboard buttons — must happen after innerHTML is set
  const btnFull   = document.getElementById("gf-open-full");
  const btnFooter = document.getElementById("gf-open-footer");
  if (btnFull)   btnFull.addEventListener("click", openDashboard);
  if (btnFooter) btnFooter.addEventListener("click", openDashboard);
});
