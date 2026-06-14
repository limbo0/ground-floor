// dashboard.js — renders both Attention and Notes tabs

// ── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ── Shared constants ─────────────────────────────────────────────────────────
const EMOTION_COLORS = {
  "Curiosity": "#7a9e8e", "Inspiration": "#c4956a", "To think": "#7b8fa8",
  "Calm": "#8eaa8e", "Avoiding work": "#b07070", "Validation": "#a08ab0",
  "Loneliness": "#6e90a8", "Habit": "#9a9a82"
};
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true}); }
function fmtDate(iso) {
  const d = new Date(iso), now = new Date(), diff = (now-d)/(86400000);
  if (diff < 1) return "today";
  if (diff < 2) return "yesterday";
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
function topOf(arr, key) {
  if (!arr.length) return "—";
  const c = {}; arr.forEach(e => { c[e[key]] = (c[e[key]]||0)+1; });
  return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0];
}
function inWindow(entries, hours) { return entries.filter(e => (Date.now()-new Date(e.timestamp)) < hours*3600000); }
function hexToRgba(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}
function avg(arr, key) { return arr.length ? arr.reduce((s,x)=>s+(x[key]||0),0)/arr.length : 0; }
function sum(arr, key) { return arr.reduce((s,x)=>s+(x[key]||0),0); }

// ═══════════════════════════════════════════════════════════════════════════
// ATTENTION TAB
// ═══════════════════════════════════════════════════════════════════════════

function renderAttention(entries) {
  const el = document.getElementById("attention-content");

  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-title">Nothing here yet.</div><div class="empty-sub">Open Substack and make your first entry.<br>Patterns take shape after a few sessions.</div></div>`;
    return;
  }

  const week = inWindow(entries,168), today = entries.filter(e=>new Date(e.timestamp).toDateString()===new Date().toDateString());
  const counts = {}; entries.forEach(e=>{counts[e.reason]=(counts[e.reason]||0)+1;});
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const maxC = sorted[0]?.[1]||1;

  // Reflections
  const refs = [];
  if (week.length) refs.push(`You opened Substack ${week.length} time${week.length!==1?'s':''} this week. Most often from "${topOf(week,'reason')}".`);
  const late = entries.filter(e=>{const h=new Date(e.timestamp).getHours();return h>=22||h<=4;});
  if (late.length>=2) refs.push(`Late at night, you arrive most often with "${topOf(late,'reason')}".`);
  const aft = entries.filter(e=>{const h=new Date(e.timestamp).getHours();return h>=13&&h<=17;});
  if (aft.length>=2) refs.push(`Your afternoon sessions lean toward "${topOf(aft,'reason')}".`);
  if (sorted[0]?.[1]>=3) refs.push(`"${sorted[0][0]}" accounts for ${Math.round(sorted[0][1]/entries.length*100)}% of your sessions.`);
  const comp = entries.filter(e=>["Habit","Avoiding work","Loneliness","Validation"].includes(e.reason));
  if (entries.length>=5 && comp.length/entries.length>0.6) refs.push(`${Math.round(comp.length/entries.length*100)}% of sessions begin from compulsive intent.`);

  // TOD
  const segs = ["Morning","Afternoon","Evening","Night"];
  const segMap = e => { const h=new Date(e.timestamp).getHours(); if(h>=5&&h<12)return"Morning"; if(h>=12&&h<17)return"Afternoon"; if(h>=17&&h<21)return"Evening"; return"Night"; };
  const segData = {}; segs.forEach(s=>{segData[s]=[];}); entries.forEach(e=>segData[segMap(e)].push(e));

  // Heatmap
  const emotions = Object.keys(EMOTION_COLORS);
  const matrix = {}; emotions.forEach(em=>{matrix[em]=[0,0,0,0,0,0,0];});
  entries.forEach(e=>{if(matrix[e.reason])matrix[e.reason][new Date(e.timestamp).getDay()]++;});
  const allC = Object.values(matrix).flat(); const maxV = Math.max(...allC,1);

  const recentEntries = entries.slice(-30).reverse();

  el.innerHTML = `
    <!-- Stats -->
    <div class="stats-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-cell"><div class="stat-big">${today.length}</div><div class="stat-label">Today</div></div>
      <div class="stat-cell"><div class="stat-big">${week.length}</div><div class="stat-label">This week</div></div>
      <div class="stat-cell"><div class="stat-big">${entries.length}</div><div class="stat-label">All time</div></div>
      <div class="stat-cell"><div class="stat-big">${Object.keys(counts).length}</div><div class="stat-label">Emotions</div></div>
    </div>

    ${refs.length ? `
    <div class="sh">Weekly reflection</div>
    <div class="reflection-card">
      <div class="reflection-label">Patterns noticed</div>
      <div class="reflection-items">${refs.map(r=>`<div class="reflection-item">${r}</div>`).join("")}</div>
    </div>` : ""}

    <div class="sh">Emotional breakdown</div>
    <div class="card">
      <div class="bar-list">${sorted.map(([em,c])=>{
        const color=EMOTION_COLORS[em]||"#8b7d6b";
        return `<div class="bar-row">
          <span class="bar-name">${em}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(c/maxC*100)}%;background:${color}"></div></div>
          <span class="bar-val">${Math.round(c/entries.length*100)}%</span>
        </div>`;}).join("")}
      </div>
    </div>

    <div class="sh">Time of day</div>
    <div class="card">
      <div class="tod-grid">${segs.map(s=>{
        const arr=segData[s], top=arr.length?topOf(arr,'reason'):'—';
        return `<div class="tod-cell"><div class="tod-time">${s}</div><div class="tod-count">${arr.length}</div><div class="tod-top">${top}</div></div>`;
      }).join("")}</div>
    </div>

    <div class="sh">Emotional fingerprint — by day of week</div>
    <div class="card">
      <div class="heatmap-wrap">
        <div class="heatmap-header">${DAY_NAMES.map(d=>`<div class="hm-day-lbl">${d}</div>`).join("")}</div>
        ${emotions.map(em=>{
          const color=EMOTION_COLORS[em];
          const cells=matrix[em].map((cnt,i)=>{
            const bg=cnt===0?"#e8e3da":hexToRgba(color,0.15+(cnt/maxV)*0.85);
            return `<div class="hm-cell" style="background:${bg}" title="${em}·${DAY_NAMES[i]}:${cnt}"></div>`;
          }).join("");
          return `<div class="hm-row"><span class="hm-label">${em}</span><div class="hm-days">${cells}</div></div>`;
        }).join("")}
      </div>
    </div>

    <div class="sh">Recent timeline</div>
    <div class="card">
      ${recentEntries.slice(0,20).map((e,i)=>{
        const color=EMOTION_COLORS[e.reason]||"#8b7d6b";
        return `<div class="tl-entry" style="animation-delay:${i*.04}s">
          <span class="tl-time">${fmtTime(e.timestamp)}</span>
          <div class="tl-dot" style="background:${color}"></div>
          <span class="tl-label">${e.reason}</span>
          <span class="tl-date">${fmtDate(e.timestamp)}</span>
        </div>`;
      }).join("")}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTES TAB
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// BUILD 3 — ENGAGEMENT VELOCITY + COMMENTER TIMING UI
// RULE: UI never calculates insights. Receives data from analytics layer.
// ═══════════════════════════════════════════════════════════════════════════

function renderEngagementVelocity(resurgingNotes, overallVelocity) {
  if (!resurgingNotes && !overallVelocity) return "";
  if (!resurgingNotes || !resurgingNotes.length) {
    if (!overallVelocity) return "";
    // Only show overall trend if no resurging notes
    return `
      <div class="sh">Engagement velocity</div>
      <div class="card" style="padding:18px;margin-bottom:28px">
        <div class="vel-trend ${overallVelocity.direction}">
          <span class="vel-arrow">${overallVelocity.direction === "up" ? "↑" : overallVelocity.direction === "down" ? "↓" : "→"}</span>
          <span class="vel-text">${overallVelocity.trend}</span>
        </div>
      </div>`;
  }

  const cardsHTML = resurgingNotes.map(note => `
    <div class="vel-card ${note.signal}">
      <div class="vel-card-header">
        <span class="vel-badge ${note.signal}">${note.signal === "strong" ? "Strong signal" : "Resurging"}</span>
        <span class="vel-age">${note.ageDays} days old</span>
      </div>
      <div class="vel-preview">"${note.bodyPreview}"</div>
      <div class="vel-stats">
        ${note.likesDelta > 0 ? `<span class="vel-stat">+${note.likesDelta} likes</span>` : ""}
        ${note.restacksDelta > 0 ? `<span class="vel-stat restack">+${note.restacksDelta} restacks</span>` : ""}
      </div>
      <div class="vel-reason">${note.reason}</div>
      ${note.url ? `<a class="vel-link" href="${note.url}" target="_blank">View note ↗</a>` : ""}
    </div>`).join("");

  return `
    <div class="sh">Engagement velocity</div>
    ${overallVelocity ? `
    <div class="vel-trend-bar ${overallVelocity.direction}">
      <span class="vel-arrow">${overallVelocity.direction === "up" ? "↑" : overallVelocity.direction === "down" ? "↓" : "→"}</span>
      <span class="vel-text">${overallVelocity.trend}</span>
    </div>` : ""}
    <div style="margin-bottom:28px">${cardsHTML}</div>
  `;
}

function renderCommenterTiming(timingData, gapData) {
  if (!timingData) return "";

  const segmentOrder = ["Early morning","Morning","Midday","Afternoon","Evening","Night","Late night"];
  const maxSegCount  = Math.max(...Object.values(timingData.segmentCounts), 1);

  const segBarsHTML = segmentOrder
    .filter(s => timingData.segmentCounts[s])
    .map(s => {
      const count = timingData.segmentCounts[s] || 0;
      const pct   = Math.round(count / maxSegCount * 100);
      const isPeak = s === timingData.peakSegment;
      return `
        <div class="timing-row">
          <span class="timing-label ${isPeak ? "peak" : ""}">${s}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${isPeak ? "var(--warm)" : "var(--accent)"}"></div>
          </div>
          <span class="timing-count">${count}</span>
        </div>`;
    }).join("");

  const dayBarsHTML = timingData.dayDistribution
    .filter(d => d.count > 0)
    .map(d => {
      const maxDay = Math.max(...timingData.dayDistribution.map(x => x.count), 1);
      const pct    = Math.round(d.count / maxDay * 100);
      const isPeak = d.day === timingData.peakDay;
      return `
        <div class="timing-row">
          <span class="timing-label ${isPeak ? "peak" : ""}">${d.short}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${isPeak ? "var(--blue)" : "var(--accent)"}"></div>
          </div>
          <span class="timing-count">${d.count}</span>
        </div>`;
    }).join("");

  return `
    <div class="sh">When your readers engage</div>
    <div class="card" style="padding:20px;margin-bottom:28px">
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.6">
        ${timingData.insight}
      </div>

      ${gapData ? `
      <div class="timing-gap ${gapData.wellAligned ? "aligned" : "misaligned"}">
        <div class="timing-gap-label">${gapData.wellAligned ? "✓ Timing aligned" : "⚠ Timing gap detected"}</div>
        <div class="timing-gap-text">${gapData.gapSignal}</div>
      </div>` : ""}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px">
        <div>
          <div class="sh" style="margin-bottom:10px">Time of day</div>
          <div class="bar-list">${segBarsHTML}</div>
        </div>
        <div>
          <div class="sh" style="margin-bottom:10px">Day of week</div>
          <div class="bar-list">${dayBarsHTML}</div>
        </div>
      </div>

      ${timingData.recommendation ? `
      <div class="timing-rec">${timingData.recommendation}</div>` : ""}
    </div>
  `;
}

function renderNotesEmpty() {
  return `
    <div class="scraper-box">
      <div class="scraper-title">Your Notes, Decoded</div>
      <div class="scraper-sub">Enter your Substack handle and Ground Floor will pull your Notes analytics directly — likes, restacks, replies, posting patterns — no Python, no terminal.</div>
      <div class="input-row">
        <input class="handle-input" id="handle-input" type="text" placeholder="yourhandle" />
        <button class="scrape-btn" id="scrape-btn">Fetch Notes</button>
      </div>
      <div class="progress-area" id="progress-area"></div>
      <div class="last-scraped" id="last-scraped"></div>
    </div>
  `;
}

async function renderNotesData(data) {
  const notes = data.notes;
  if (!notes.length) return `<div class="empty-state"><div class="empty-title">No notes found.</div><div class="empty-sub">Try scraping again after posting some Notes.</div></div>`;

  // Load engagement snapshot for velocity calculation
  const prevSnapshot   = await loadEngagementSnapshot();
  const resurgingNotes = prevSnapshot ? detectResurgingNotes(notes, prevSnapshot) : [];
  const overallVel     = prevSnapshot ? calculateOverallVelocity(notes, prevSnapshot) : null;

  const totalLikes    = sum(notes,"likes");
  const totalRestacks = sum(notes,"restacks");
  const totalReplies  = sum(notes,"replies");
  const totalViews    = sum(notes,"views");
  // Avg engagement — if views available shows %, otherwise shows avg interactions per note
  const hasViews = notes.some(n => n.views > 0);
  const avgEng = notes.length
    ? hasViews
      ? (sum(notes,"engRate")/notes.length).toFixed(1) + "%"
      : Math.round(sum(notes,"likes")/notes.length) + " likes avg"
    : "0";

  // Top 5 by likes
  const top5 = [...notes].sort((a,b)=>b.likes-a.likes).slice(0,5);

  // Day breakdown
  const dayData = {}; DAY_NAMES.forEach(d=>{dayData[d]={count:0,likes:0,restacks:0};});
  notes.forEach(n=>{ if(n.dayOfWeek && dayData[n.dayOfWeek]) { dayData[n.dayOfWeek].count++; dayData[n.dayOfWeek].likes+=n.likes; dayData[n.dayOfWeek].restacks+=n.restacks; }});
  const maxDayCount = Math.max(...Object.values(dayData).map(d=>d.count),1);

  // Media type
  const mediaCount = {text:0,image:0,link:0};
  notes.forEach(n=>{ if(mediaCount[n.mediaType]!==undefined) mediaCount[n.mediaType]++; });

  // Weekly trend (last 12 weeks)
  const weekBuckets = {};
  notes.forEach(n=>{
    if(!n.date) return;
    const d=new Date(n.date), wk=`${d.getFullYear()}-W${Math.ceil(d.getDate()/7)}`;
    weekBuckets[wk]=(weekBuckets[wk]||0)+1;
  });
  const weekEntries = Object.entries(weekBuckets).sort().slice(-12);
  const maxWk = Math.max(...weekEntries.map(e=>e[1]),1);

  // Best posting hour
  const hourCounts = {}; notes.forEach(n=>{ if(n.hour!==null) hourCounts[n.hour]=(hourCounts[n.hour]||0)+1; });
  const bestHour = Object.entries(hourCounts).sort((a,b)=>b[1]-a[1])[0];
  const bestHourLabel = bestHour ? new Date(0,0,0,parseInt(bestHour[0])).toLocaleTimeString("en-US",{hour:"numeric",hour12:true}) : "—";

  const scrapedDate = new Date(data.scrapedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

  return `
    <div class="scraper-box" style="text-align:left;padding:20px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:18px;color:var(--ink)">@${data.handle}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--faint);margin-top:2px">Last fetched ${scrapedDate}</div>
        </div>
        <div style="display:flex;gap:8px">
          <input class="handle-input" id="handle-input" type="text" placeholder="${data.handle}" style="width:140px"/>
          <button class="scrape-btn" id="scrape-btn">Refresh</button>
        </div>
      </div>
      <div class="progress-area" id="progress-area"></div>
    </div>

    <!-- Stats -->
    <div class="stats-row notes-stats" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat-cell"><div class="stat-big">${notes.length}</div><div class="stat-label">Notes</div></div>
      <div class="stat-cell"><div class="stat-big">${totalLikes}</div><div class="stat-label">Likes</div></div>
      <div class="stat-cell"><div class="stat-big">${totalRestacks}</div><div class="stat-label">Restacks</div></div>
      <div class="stat-cell"><div class="stat-big">${totalReplies}</div><div class="stat-label">Replies</div></div>
      <div class="stat-cell"><div class="stat-big" style="font-size:${avgEng.length > 6 ? '18px' : '32px'}">${avgEng}</div><div class="stat-label">Avg Eng.</div></div>
    </div>

    <!-- Insights -->
    <div class="sh">Insights</div>
    <div class="reflection-card">
      <div class="reflection-label">What the data says</div>
      <div class="reflection-items">
        <div class="reflection-item">Your best time to post is around ${bestHourLabel} — that's when your notes land most often.</div>
        <div class="reflection-item">${DAY_NAMES.reduce((best,d)=>dayData[d].count>dayData[best].count?d:best,DAY_NAMES[0])} is your most active posting day.</div>
        ${top5[0] ? `<div class="reflection-item">Your top note earned ${top5[0].likes} likes${top5[0].restacks>0?` and ${top5[0].restacks} restacks`:''}.</div>` : ""}
        ${totalViews > 0 ? `<div class="reflection-item">Across all notes, you've accumulated ${totalViews.toLocaleString()} views.</div>` : ""}
      </div>
    </div>

    <!-- Velocity -->
    ${renderEngagementVelocity(resurgingNotes, overallVel)}

    <!-- Timing -->
    ${renderCommenterTiming(
        analyseCommenterTiming(data._readers || []),
        analyseTimingGap(notes, analyseCommenterTiming(data._readers || []))
      )}

    <!-- Top notes -->
    <div class="sh">Top notes by likes</div>
    <div class="card" style="padding:16px">
      <div class="top-notes">
        ${top5.map((n,i)=>`
          <div class="note-card">
            <div class="note-rank">${i+1}</div>
            <div class="note-body">
              <div class="note-preview">${n.bodyPreview || "(No text preview)"}</div>
              <div class="note-meta">
                <span class="note-pill highlight">♡ ${n.likes}</span>
                <span class="note-pill">↻ ${n.restacks}</span>
                <span class="note-pill">💬 ${n.replies}</span>
                ${n.views>0?`<span class="note-pill">${n.views} views</span>`:""}
                <span class="note-pill">${n.dateLabel}</span>
                <span class="note-pill">${n.mediaType}</span>
                ${n.url?`<a class="note-link" href="${n.url}" target="_blank">View ↗</a>`:""}
              </div>
            </div>
          </div>`).join("")}
      </div>
    </div>

    <!-- Day breakdown -->
    <div class="sh">Posting by day of week</div>
    <div class="card">
      <div class="day-grid">
        ${DAY_NAMES.map(d=>{
          const dd=dayData[d];
          const avgLikes = dd.count ? (dd.likes/dd.count).toFixed(1) : "0";
          return `<div class="day-cell">
            <div class="day-name">${d}</div>
            <div class="day-count">${dd.count}</div>
            <div class="day-avg">~${avgLikes} likes</div>
          </div>`;
        }).join("")}
      </div>
    </div>

    <!-- Media type -->
    <div class="sh">Content type breakdown</div>
    <div class="card">
      <div class="media-row">
        <div class="media-pill"><div class="media-icon">📝</div><div class="media-count">${mediaCount.text}</div><div class="media-label">Text</div></div>
        <div class="media-pill"><div class="media-icon">🖼️</div><div class="media-count">${mediaCount.image}</div><div class="media-label">Image</div></div>
        <div class="media-pill"><div class="media-icon">🔗</div><div class="media-count">${mediaCount.link}</div><div class="media-label">Link</div></div>
      </div>
    </div>

    <!-- Weekly trend -->
    ${weekEntries.length > 1 ? `
    <div class="sh">Weekly posting trend</div>
    <div class="card">
      <div class="week-chart">
        ${weekEntries.map(([wk,cnt])=>`
          <div class="week-bar-wrap">
            <div class="week-bar" style="height:${Math.round(cnt/maxWk*72)+8}px"></div>
            <div class="week-lbl">${cnt}</div>
          </div>`).join("")}
      </div>
    </div>` : ""}
  `;
}

async function attachScrapeBtn(existingHandle) {
  const btn = document.getElementById("scrape-btn");
  const input = document.getElementById("handle-input");
  const progress = document.getElementById("progress-area");
  if (!btn || !input) return;

  btn.addEventListener("click", async () => {
    const handle = input.value.trim() || existingHandle;
    if (!handle) { input.focus(); return; }

    chrome.storage.local.set({ gf_settings: { handle } }, () => console.log('Handle saved:', handle));

    if (handle !== existingHandle) await Storage.clearReaders();

    btn.disabled = true;
    progress.innerHTML = `<div class="progress-msg">Starting…</div><div class="progress-bar-track"><div class="progress-bar-fill" id="prog-fill" style="width:5%"></div></div>`;

    const fill = () => document.getElementById("prog-fill");

    try {
      await scrapeNotes(handle, ({ stage, message, fetched }) => {
        const msg = document.querySelector(".progress-msg");
        if (msg) msg.textContent = message;
        if (fill()) {
          if (stage === "resolving") fill().style.width = "15%";
          else if (stage === "fetching") fill().style.width = Math.min(15 + (fetched || 0) * 0.5, 80) + "%";
          else if (stage === "parsing") fill().style.width = "90%";
          else if (stage === "done") fill().style.width = "100%";
        }
      });

      // Re-render notes + correlations tabs
      const saved = await Storage.getNotes();
      if (saved.handle !== existingHandle) await Storage.clearReaders();
      document.getElementById("notes-content").innerHTML = await renderNotesData(saved);
      attachScrapeBtn(saved.handle);
      // Refresh correlations via background
      chrome.runtime.sendMessage({ action: "getData" }, (resp) => {
        const entries = (resp && resp.ok && resp.data.gf_entries) || [];
        renderCorrelations(entries, saved);
      });

    } catch (err) {
      progress.innerHTML = `<div class="progress-msg" style="color:#b07070">Error: ${err.message}</div>`;
      btn.disabled = false;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// CORRELATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

// ── Correlation 1: Emotional intent vs note performance ───────────────────
// Match emotional entries to notes posted within 4 hours after the session
function correlateEmotionToNotes(entries, notes) {
  if (!entries.length || !notes.length) return null;

  const results = {}; // emotion → { totalLikes, totalRestacks, sessions, matchedNotes }
  Object.keys(EMOTION_COLORS).forEach(em => {
    results[em] = { totalLikes: 0, totalRestacks: 0, sessions: 0, matchedNotes: 0 };
  });

  entries.forEach(entry => {
    const sessionTime = new Date(entry.timestamp).getTime();
    const emotion = entry.reason;
    if (!results[emotion]) return;
    results[emotion].sessions++;

    // Find notes posted within 4 hours after this emotional session
    const nearby = notes.filter(n => {
      if (!n.date) return false;
      const noteTime = new Date(n.date).getTime();
      const diff = noteTime - sessionTime;
      return diff >= 0 && diff <= 4 * 3600000;
    });

    if (nearby.length) {
      results[emotion].matchedNotes += nearby.length;
      results[emotion].totalLikes   += nearby.reduce((s, n) => s + n.likes, 0);
      results[emotion].totalRestacks += nearby.reduce((s, n) => s + n.restacks, 0);
    }
  });

  // Only return emotions that have at least 1 matched note
  const withData = Object.entries(results)
    .filter(([, v]) => v.matchedNotes > 0)
    .map(([emotion, v]) => ({
      emotion,
      avgLikes: +(v.totalLikes / v.matchedNotes).toFixed(1),
      avgRestacks: +(v.totalRestacks / v.matchedNotes).toFixed(1),
      sessions: v.sessions,
      matchedNotes: v.matchedNotes
    }))
    .sort((a, b) => b.avgLikes - a.avgLikes);

  return withData.length >= 2 ? withData : null;
}

// ── Correlation 2: Word count vs likes ───────────────────────────────────
function correlateWordCountToLikes(notes) {
  const withWords = notes.filter(n => n.wordCount > 0);
  if (withWords.length < 5) return null;

  const sorted = [...withWords].sort((a, b) => a.wordCount - b.wordCount);
  const third = Math.floor(sorted.length / 3);
  const short  = sorted.slice(0, third);
  const medium = sorted.slice(third, third * 2);
  const long   = sorted.slice(third * 2);

  const avgL = arr => arr.length ? +(arr.reduce((s,n)=>s+n.likes,0)/arr.length).toFixed(1) : 0;
  const shortAvg  = avgL(short);
  const mediumAvg = avgL(medium);
  const longAvg   = avgL(long);

  const shortWc  = short.length  ? Math.round(short.reduce((s,n)=>s+n.wordCount,0)/short.length)  : 0;
  const mediumWc = medium.length ? Math.round(medium.reduce((s,n)=>s+n.wordCount,0)/medium.length) : 0;
  const longWc   = long.length   ? Math.round(long.reduce((s,n)=>s+n.wordCount,0)/long.length)   : 0;

  const best = shortAvg >= mediumAvg && shortAvg >= longAvg ? "short"
    : longAvg >= shortAvg && longAvg >= mediumAvg ? "long" : "medium";

  return { shortAvg, mediumAvg, longAvg, shortWc, mediumWc, longWc, best };
}

// ── Correlation 3: Posting hour vs avg likes ──────────────────────────────
function correlateHourToLikes(notes) {
  if (notes.length < 5) return null;
  const hourBuckets = {};
  notes.forEach(n => {
    if (n.hour === null) return;
    if (!hourBuckets[n.hour]) hourBuckets[n.hour] = [];
    hourBuckets[n.hour].push(n.likes);
  });

  const hourAvgs = Object.entries(hourBuckets)
    .filter(([, arr]) => arr.length >= 2)
    .map(([h, arr]) => ({
      hour: parseInt(h),
      avgLikes: +(arr.reduce((s,v)=>s+v,0)/arr.length).toFixed(1),
      count: arr.length,
      label: new Date(0,0,0,parseInt(h)).toLocaleTimeString("en-US",{hour:"numeric",hour12:true})
    }))
    .sort((a, b) => b.avgLikes - a.avgLikes);

  return hourAvgs.length >= 2 ? hourAvgs.slice(0, 5) : null;
}

// ── Correlation 4: Posting frequency vs per-note engagement ──────────────
function correlateFrequencyToEngagement(notes) {
  if (notes.length < 8) return null;
  const weekBuckets = {};
  notes.forEach(n => {
    if (!n.date) return;
    const d = new Date(n.date);
    const wk = `${d.getFullYear()}-${String(Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)).padStart(2,"0")}-${d.getMonth()}`;
    if (!weekBuckets[wk]) weekBuckets[wk] = [];
    weekBuckets[wk].push(n);
  });

  const weeks = Object.values(weekBuckets).filter(w => w.length > 0);
  if (weeks.length < 4) return null;

  const lightWeeks = weeks.filter(w => w.length === 1);
  const heavyWeeks = weeks.filter(w => w.length >= 3);

  if (!lightWeeks.length || !heavyWeeks.length) return null;

  const avgEngLight = +(lightWeeks.flat().reduce((s,n)=>s+n.likes,0) / lightWeeks.flat().length).toFixed(1);
  const avgEngHeavy = +(heavyWeeks.flat().reduce((s,n)=>s+n.likes,0) / heavyWeeks.flat().length).toFixed(1);

  return {
    lightAvg: avgEngLight,
    heavyAvg: avgEngHeavy,
    lightWeeks: lightWeeks.length,
    heavyWeeks: heavyWeeks.length,
    verdict: avgEngLight > avgEngHeavy ? "less_is_more" : "momentum"
  };
}

// ── Correlation 5: Media type vs engagement ───────────────────────────────
function correlateMediaToEngagement(notes) {
  if (notes.length < 5) return null;
  const types = { text: [], image: [], link: [] };
  notes.forEach(n => { if (types[n.mediaType]) types[n.mediaType].push(n); });

  return Object.entries(types)
    .filter(([, arr]) => arr.length >= 2)
    .map(([type, arr]) => ({
      type,
      avgLikes: +(arr.reduce((s,n)=>s+n.likes,0)/arr.length).toFixed(1),
      avgRestacks: +(arr.reduce((s,n)=>s+n.restacks,0)/arr.length).toFixed(1),
      count: arr.length
    }))
    .sort((a, b) => b.avgLikes - a.avgLikes);
}

// ── Correlation 6: Recency decay ─────────────────────────────────────────
function analyseRecencyDecay(notes) {
  if (notes.length < 10) return null;
  const now = Date.now();
  const recent  = notes.filter(n => n.date && (now - new Date(n.date)) < 14 * 86400000);
  const older   = notes.filter(n => n.date && (now - new Date(n.date)) >= 30 * 86400000);
  if (!recent.length || !older.length) return null;

  const avgRecent = +(recent.reduce((s,n)=>s+n.likes,0)/recent.length).toFixed(1);
  const avgOlder  = +(older.reduce((s,n)=>s+n.likes,0)/older.length).toFixed(1);
  const ratio = avgOlder > 0 ? +(avgRecent / avgOlder).toFixed(2) : null;

  return { avgRecent, avgOlder, ratio, recentCount: recent.length, olderCount: older.length };
}

// ── Month-by-month top 5 ──────────────────────────────────────────────────
function buildMonthlyBreakdown(notes) {
  const months = {};
  notes.forEach(n => {
    if (!n.date) return;
    const d = new Date(n.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!months[key]) months[key] = { notes: [], label: d.toLocaleDateString("en-US",{month:"long",year:"numeric"}) };
    months[key].notes.push(n);
  });

  return Object.entries(months)
    .sort((a,b) => b[0].localeCompare(a[0])) // newest first
    .slice(0, 12)
    .map(([key, { notes: mNotes, label }]) => ({
      key, label,
      count: mNotes.length,
      totalLikes: mNotes.reduce((s,n)=>s+n.likes,0),
      totalRestacks: mNotes.reduce((s,n)=>s+n.restacks,0),
      top5: [...mNotes].sort((a,b)=>b.likes-a.likes).slice(0,5)
    }));
}

// ── Render correlations tab ───────────────────────────────────────────────
function renderCorrelations(entries, notesData) {
  const el = document.getElementById("correlations-content");
  const notes = notesData?.notes || [];

  const hasEntries = entries.length >= 3;
  const hasNotes   = notes.length >= 3;

  if (!hasEntries && !hasNotes) {
    el.innerHTML = `<div class="insufficient">Correlations emerge after more sessions and notes are recorded.<br><br>Keep using Ground Floor and fetch your Notes data first.</div>`;
    return;
  }

  // Run all correlations
  const emotionCorr  = hasEntries && hasNotes ? correlateEmotionToNotes(entries, notes) : null;
  const wordCorr     = hasNotes ? correlateWordCountToLikes(notes) : null;
  const hourCorr     = hasNotes ? correlateHourToLikes(notes) : null;
  const freqCorr     = hasNotes ? correlateFrequencyToEngagement(notes) : null;
  const mediaCorr    = hasNotes ? correlateMediaToEngagement(notes) : null;
  const decayCorr    = hasNotes ? analyseRecencyDecay(notes) : null;
  const monthly      = hasNotes ? buildMonthlyBreakdown(notes) : [];

  const maxIntentLikes = emotionCorr ? Math.max(...emotionCorr.map(e=>e.avgLikes),1) : 1;
  const maxHourLikes   = hourCorr ? Math.max(...hourCorr.map(h=>h.avgLikes),1) : 1;
  const maxMediaLikes  = mediaCorr ? Math.max(...mediaCorr.map(m=>m.avgLikes),1) : 1;

  el.innerHTML = `

    <!-- ① EMOTIONAL INTENT CORRELATION — Ground Floor signature -->
    ${emotionCorr ? `
    <div class="sh">Emotional intent vs note performance</div>
    <div class="emotion-intent-card">
      <div class="reflection-label">Ground Floor signature insight</div>
      <div class="reflection-item" style="margin-bottom:0;padding-left:0;border-left:none;font-size:15px">
        ${emotionCorr[0].emotion === "Curiosity" || emotionCorr[0].emotion === "Inspiration" || emotionCorr[0].emotion === "To think" || emotionCorr[0].emotion === "Calm"
          ? `Your most intentional emotional state — <strong>${emotionCorr[0].emotion}</strong> — produces your highest-performing notes, averaging ${emotionCorr[0].avgLikes} likes.`
          : `Notes written after arriving with <strong>${emotionCorr[0].emotion}</strong> average ${emotionCorr[0].avgLikes} likes — your highest across all emotional states.`}
      </div>
      <div class="intent-rows">
        ${emotionCorr.map(e => {
          const color = EMOTION_COLORS[e.emotion] || "#8b7d6b";
          const pct = Math.round(e.avgLikes / maxIntentLikes * 100);
          return `<div class="intent-row">
            <div class="intent-dot" style="background:${color}"></div>
            <span class="intent-label">${e.emotion}</span>
            <span class="intent-avg">♡ ${e.avgLikes} avg</span>
            <div class="intent-bar-track">
              <div class="intent-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <span class="intent-sessions">${e.matchedNotes} note${e.matchedNotes!==1?'s':''}</span>
          </div>`;
        }).join("")}
      </div>
    </div>` : `
    <div class="sh">Emotional intent vs note performance</div>
    <div class="card"><div class="insufficient">This correlation needs both emotional sessions and notes data.<br>Fetch your Notes and keep logging your intent when you open Substack.</div></div>`}

    <!-- ② WORD COUNT vs LIKES -->
    ${wordCorr ? `
    <div class="sh">Note length vs engagement</div>
    <div class="corr-grid">
      <div class="corr-card">
        <div class="corr-title">Does length matter for you?</div>
        <div class="corr-sub">Average likes by note length — short, medium, and long thirds of your notes.</div>
        <div class="corr-finding ${wordCorr.best === 'short' ? 'positive' : wordCorr.best === 'long' ? 'neutral' : 'positive'}">
          ${wordCorr.best === 'short'
            ? `Your shortest notes (under ~${wordCorr.shortWc} words) earn the most likes. Your audience rewards brevity.`
            : wordCorr.best === 'long'
            ? `Your longer notes (${wordCorr.longWc}+ words) outperform shorter ones. Depth is landing.`
            : `Medium-length notes (~${wordCorr.mediumWc} words) are your sweet spot.`}
        </div>
        <div class="corr-pairs">
          ${[
            { label: `Short (~${wordCorr.shortWc}w)`, val: wordCorr.shortAvg, max: Math.max(wordCorr.shortAvg,wordCorr.mediumAvg,wordCorr.longAvg,1) },
            { label: `Medium (~${wordCorr.mediumWc}w)`, val: wordCorr.mediumAvg, max: Math.max(wordCorr.shortAvg,wordCorr.mediumAvg,wordCorr.longAvg,1) },
            { label: `Long (~${wordCorr.longWc}w)`, val: wordCorr.longAvg, max: Math.max(wordCorr.shortAvg,wordCorr.mediumAvg,wordCorr.longAvg,1) }
          ].map(r=>`<div class="corr-pair">
            <span class="corr-pair-label">${r.label}</span>
            <div class="corr-pair-bar"><div class="corr-pair-fill" style="width:${Math.round(r.val/r.max*100)}%;background:#c4956a"></div></div>
            <span class="corr-pair-val">♡ ${r.val}</span>
          </div>`).join("")}
        </div>
      </div>

      <!-- ③ MEDIA TYPE vs LIKES -->
      ${mediaCorr ? `<div class="corr-card">
        <div class="corr-title">Content type vs engagement</div>
        <div class="corr-sub">Average likes and restacks by whether you post text, image, or link notes.</div>
        <div class="corr-finding ${mediaCorr[0].type === 'image' ? 'positive' : 'neutral'}">
          ${mediaCorr[0].type === 'image'
            ? `Image notes earn the most likes for you — ${mediaCorr[0].avgLikes} on average. Visual content is resonating.`
            : mediaCorr[0].type === 'link'
            ? `Link notes lead with ${mediaCorr[0].avgLikes} avg likes. Curating well is working.`
            : `Pure text notes outperform everything else at ${mediaCorr[0].avgLikes} avg likes. Your writing is the product.`}
        </div>
        <div class="corr-pairs">
          ${mediaCorr.map(m=>`<div class="corr-pair">
            <span class="corr-pair-label">${m.type === 'text' ? '📝 Text' : m.type === 'image' ? '🖼️ Image' : '🔗 Link'} (${m.count})</span>
            <div class="corr-pair-bar"><div class="corr-pair-fill" style="width:${Math.round(m.avgLikes/maxMediaLikes*100)}%;background:#7a9e8e"></div></div>
            <span class="corr-pair-val">♡ ${m.avgLikes}</span>
          </div>`).join("")}
        </div>
      </div>` : ""}
    </div>` : ""}

    <!-- ④ POSTING HOUR vs LIKES -->
    ${hourCorr ? `
    <div class="sh">Best hour to post</div>
    <div class="corr-card" style="margin-bottom:28px">
      <div class="corr-title">When does your writing land?</div>
      <div class="corr-sub">Average likes by hour posted — hours with fewer than 2 notes excluded.</div>
      <div class="corr-finding positive">
        Your highest-performing hour is <strong>${hourCorr[0].label}</strong> — averaging ${hourCorr[0].avgLikes} likes across ${hourCorr[0].count} notes.
      </div>
      <div class="corr-pairs">
        ${hourCorr.map(h=>`<div class="corr-pair">
          <span class="corr-pair-label">${h.label} <span style="color:var(--faint)">(${h.count} notes)</span></span>
          <div class="corr-pair-bar"><div class="corr-pair-fill" style="width:${Math.round(h.avgLikes/maxHourLikes*100)}%;background:#7b8fa8"></div></div>
          <span class="corr-pair-val">♡ ${h.avgLikes}</span>
        </div>`).join("")}
      </div>
    </div>` : ""}

    <!-- ⑤ FREQUENCY vs ENGAGEMENT -->
    ${freqCorr ? `
    <div class="sh">Posting frequency vs per-note engagement</div>
    <div class="corr-card" style="margin-bottom:28px">
      <div class="corr-title">Does posting more dilute your signal?</div>
      <div class="corr-sub">Comparing weeks when you posted rarely vs heavily — which produced stronger per-note engagement?</div>
      <div class="corr-finding ${freqCorr.verdict === 'less_is_more' ? 'positive' : 'neutral'}">
        ${freqCorr.verdict === 'less_is_more'
          ? `In lighter weeks (1 note), your notes averaged ${freqCorr.lightAvg} likes. In heavier weeks (3+), that drops to ${freqCorr.heavyAvg}. Restraint is working in your favour.`
          : `Your heavier posting weeks (3+ notes) average ${freqCorr.heavyAvg} likes per note vs ${freqCorr.lightAvg} in quieter weeks. Momentum is real for you.`}
      </div>
      <div class="corr-pairs">
        <div class="corr-pair">
          <span class="corr-pair-label">Light weeks (1 note) — ${freqCorr.lightWeeks} weeks</span>
          <div class="corr-pair-bar"><div class="corr-pair-fill" style="width:${Math.round(freqCorr.lightAvg/Math.max(freqCorr.lightAvg,freqCorr.heavyAvg,1)*100)}%;background:#8eaa8e"></div></div>
          <span class="corr-pair-val">♡ ${freqCorr.lightAvg}</span>
        </div>
        <div class="corr-pair">
          <span class="corr-pair-label">Heavy weeks (3+ notes) — ${freqCorr.heavyWeeks} weeks</span>
          <div class="corr-pair-bar"><div class="corr-pair-fill" style="width:${Math.round(freqCorr.heavyAvg/Math.max(freqCorr.lightAvg,freqCorr.heavyAvg,1)*100)}%;background:#8eaa8e"></div></div>
          <span class="corr-pair-val">♡ ${freqCorr.heavyAvg}</span>
        </div>
      </div>
    </div>` : ""}

    <!-- ⑥ RECENCY DECAY -->
    ${decayCorr ? `
    <div class="sh">Engagement decay</div>
    <div class="corr-card" style="margin-bottom:28px">
      <div class="corr-title">Do your notes age well?</div>
      <div class="corr-sub">Comparing average likes on notes from the last 14 days vs notes older than 30 days.</div>
      <div class="corr-finding ${decayCorr.ratio && decayCorr.ratio < 0.7 ? 'negative' : decayCorr.ratio && decayCorr.ratio > 1.2 ? 'positive' : 'neutral'}">
        ${!decayCorr.ratio ? "Not enough data across both time ranges yet." :
          decayCorr.ratio < 0.7
          ? `Older notes (${decayCorr.avgOlder} avg likes) significantly outperform recent ones (${decayCorr.avgRecent} avg). Your earlier work had stronger resonance, or your audience is still finding it.`
          : decayCorr.ratio > 1.2
          ? `Recent notes (${decayCorr.avgRecent} avg likes) are outperforming older ones (${decayCorr.avgOlder} avg). Your audience and reach are growing.`
          : `Engagement is fairly consistent across time — ${decayCorr.avgRecent} avg likes recently vs ${decayCorr.avgOlder} for older notes. Your signal is stable.`}
      </div>
    </div>` : ""}

    <!-- MONTH-BY-MONTH TOP 5 -->
    ${monthly.length ? `
    <div class="sh">Month by month — top 5 notes</div>
    <div class="card" style="padding:20px">
      ${monthly.map(m => `
        <div class="month-section">
          <div class="month-header">
            <span class="month-name">${m.label}</span>
            <span class="month-meta">${m.count} notes · ${m.totalLikes} likes · ${m.totalRestacks} restacks</span>
          </div>
          <div class="top-notes">
            ${m.top5.map((n,i) => `
              <div class="note-card">
                <div class="note-rank">${i+1}</div>
                <div class="note-body">
                  <div class="note-preview">${n.bodyPreview || "(No text preview)"}</div>
                  <div class="note-meta">
                    <span class="note-pill highlight">♡ ${n.likes}</span>
                    <span class="note-pill">↻ ${n.restacks}</span>
                    <span class="note-pill">💬 ${n.replies}</span>
                    <span class="note-pill">${n.dayOfWeek} · ${n.dateLabel}</span>
                    ${n.url ? `<a class="note-link" href="${n.url}" target="_blank">View ↗</a>` : ""}
                  </div>
                </div>
              </div>`).join("")}
          </div>
        </div>`).join("")}
    </div>` : ""}
  `;
}

function loadData() {
  Storage.getAll().then(async result => {
    renderAll(
      result.gf_entries || [],
      result.gf_notes   || null,
      result.gf_readers || null
    );
  });
}

async function renderAll(entries, notesData, readersData) {
  if (entries.length) {
    document.getElementById("header-meta").innerHTML =
      `${entries.length} sessions recorded<br>since ${new Date(entries[0].timestamp).toLocaleDateString("en-US",{month:"long",year:"numeric"})}`;
  }

  renderAttention(entries);

  console.log('Handle loaded from storage:', notesData?.handle);
  const notesEl = document.getElementById("notes-content");
  if (notesData && notesData.notes?.length) {
    notesEl.innerHTML = await renderNotesData(notesData);
    attachScrapeBtn(notesData.handle);
  } else {
    notesEl.innerHTML = renderNotesEmpty();
    attachScrapeBtn("");
  }

  renderCorrelations(entries, notesData);
  renderReaders(readersData || null, notesData);
}

// Boot — wait for DOM then ask background for data
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => loadData());
} else {
  loadData();
}

// ═══════════════════════════════════════════════════════════════════════════
// READERS TAB
// ═══════════════════════════════════════════════════════════════════════════

const AVATAR_COLORS = [
  { bg: "#E1F5EE", text: "#0F6E56" },
  { bg: "#EEEDFE", text: "#3C3489" },
  { bg: "#FAEEDA", text: "#633806" },
  { bg: "#FAECE7", text: "#993C1D" },
  { bg: "#E6F1FB", text: "#0C447C" },
  { bg: "#EAF3DE", text: "#3B6D11" },
  { bg: "#FBEAF0", text: "#72243E" }
];

function avatarColor(handle) {
  if (!handle) return AVATAR_COLORS[0];
  const idx = handle.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function relativeDate(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = Date.now();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  if (diff < 1) return "today";
  if (diff < 2) return "yesterday";
  if (diff < 8) return `${Math.floor(diff)} days ago`;
  if (diff < 32) return `${Math.floor(diff / 7)} weeks ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isRising(reader, allReaders) {
  // Rising = appeared in last 14 days but wasn't in top engagers before
  const recentActivity = reader.comments.some(c => {
    if (!c.date) return false;
    return (Date.now() - new Date(c.date)) < 14 * 86400000;
  });
  return recentActivity && reader.commentCount >= 2;
}

function renderReadersEmpty(hasNotes) {
  return `
    <div class="readers-scraper-box">
      <div class="scraper-title">Who keeps showing up</div>
      <div class="scraper-sub" style="margin-bottom:16px">
        ${hasNotes
          ? "Your notes data is ready. Click below to map your readers — who comments, who restacks, and who has reach."
          : "Fetch your Notes data first from the Notes Analytics tab, then come back here to map your readers."}
      </div>
      ${hasNotes ? `
        <button class="scrape-btn" id="readers-scan-btn">Map my readers</button>
        <div class="progress-area" id="readers-progress"></div>
      ` : `
        <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--faint)">Go to Notes Analytics → Fetch Notes → come back here</div>
      `}
    </div>`;
}


// ═══════════════════════════════════════════════════════════════════════════
// BUILD 1 — COMMENT SENTIMENT + THEME CLUSTERING
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// THEME MANAGER — user-defined themes
// ═══════════════════════════════════════════════════════════════════════════


// ── Theme Manager UI ──────────────────────────────────────────────────────

function renderThemeManager(userThemes) {
  const hasThemes = userThemes.length > 0;

  const themeRowsHTML = userThemes.map((theme, i) => {
    const palette = THEME_PALETTE[i % THEME_PALETTE.length];
    return `
      <div class="tm-row" data-theme-id="${theme.id}">
        <div class="tm-dot" style="background:${palette.color}"></div>
        <input class="tm-name-input" type="text" value="${theme.name}" placeholder="Theme name" data-field="name" data-id="${theme.id}" />
        <input class="tm-kw-input" type="text" value="${theme.keywords || ""}" placeholder="keywords, comma separated" data-field="keywords" data-id="${theme.id}" />
        <button class="tm-delete-btn" data-id="${theme.id}" title="Remove">×</button>
      </div>`;
  }).join("");

  return `
    <div id="theme-manager" class="tm-box">
      <div class="tm-header">
        <div>
          <div class="tm-title">Your themes</div>
          <div class="tm-sub">Define up to 5 themes. Ground Floor tracks which ones your readers respond to.</div>
        </div>
        ${userThemes.length < 5 ? `<button class="tm-add-btn" id="tm-add-btn">+ Add theme</button>` : ""}
      </div>

      ${hasThemes ? `
        <div id="tm-rows">${themeRowsHTML}</div>
        <div class="tm-actions">
          <button class="scrape-btn" id="tm-save-btn">Save themes</button>
          <span id="tm-saved-msg" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--green);opacity:0;transition:opacity 0.3s">Saved.</span>
        </div>
      ` : `
        <div class="tm-empty">No themes yet. Add your first theme above.</div>
      `}

      <div class="tm-example">
        <span class="tm-example-label">Example:</span>
        Slow Living · <em>stillness, pause, presence, birdwatching</em>
      </div>
    </div>`;
}

function attachThemeManagerEvents(userThemes, readers, notes) {
  const addBtn = document.getElementById("tm-add-btn");
  const saveBtn = document.getElementById("tm-save-btn");

  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const fresh = await Storage.getThemes();
      if (fresh.length >= 5) return;
      fresh.push({ id: Date.now().toString(), name: "", keywords: "" });
      await saveUserThemes(fresh);
      // Re-render readers tab
      const readersData = await Storage.getReaders();
      const notesData   = await Storage.getNotes();
      renderReaders(readersData, notesData);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const rows = document.querySelectorAll(".tm-row");
      const updated = [];
      rows.forEach(row => {
        const id   = row.dataset.themeId;
        const name = row.querySelector("[data-field='name']")?.value.trim() || "";
        const kw   = row.querySelector("[data-field='keywords']")?.value.trim() || "";
        if (name) updated.push({ id, name, keywords: kw });
      });
      await saveUserThemes(updated);
      // Flash saved message
      const msg = document.getElementById("tm-saved-msg");
      if (msg) { msg.style.opacity = "1"; setTimeout(() => msg.style.opacity = "0", 2000); }
      // Re-render theme section with new themes
      const newClusters  = buildThemeCluster(updated, readers, notes || []);
      const newBlindSpot = detectEditorialBlindSpot(newClusters, notes || []);
      const themeSectionEl = document.getElementById("theme-section");
      if (themeSectionEl) themeSectionEl.innerHTML = renderThemeSectionInner(newClusters, newBlindSpot);
    });
  }

  // Delete buttons
  document.querySelectorAll(".tm-delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const fresh = await Storage.getThemes();
      const updated = fresh.filter(t => t.id !== id);
      await saveUserThemes(updated);
      const readersData = await Storage.getReaders();
      const notesData   = await Storage.getNotes();
      renderReaders(readersData, notesData);
    });
  });
}

// Inner HTML for theme results (used for live re-render after save)
function renderThemeSectionInner(clusters, blindSpot) {
  if (!clusters.length) {
    return `<div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--faint);text-align:center;padding:20px">No theme matches yet — try adjusting your keywords or rescan readers.</div>`;
  }

  const blindSpotHTML = blindSpot ? `
    <div class="card" style="padding:20px;margin-bottom:16px;border-left:3px solid var(--ink)">
      <div style="font-family:'DM Mono',monospace;font-size:9px;letter-spacing:0.12em;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Blind Spot</div>
      <div style="font-family:'Playfair Display',serif;font-size:13px;color:var(--ink);line-height:1.6">${blindSpot.statement}</div>
    </div>` : "";

  const strengthRank = { "Very High": 0, "High": 1, "Medium": 2, "Low": 3 };
  const momentumColor = { Compounding: "#1D9E75", Strong: "#7a9e8e", Emerging: "#c4956a", Fading: "#b0aa9e" };

  const clusterCardsHTML = [...clusters]
    .sort((a, b) => strengthRank[a.strengthLabel] - strengthRank[b.strengthLabel])
    .map(cluster => `
      <div class="card" style="padding:18px;margin-bottom:12px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">
          <div style="font-family:'Playfair Display',serif;font-size:15px;color:var(--ink)">${cluster.label}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted)">${cluster.strengthLabel} · <span style="color:${momentumColor[cluster.momentumLabel] || "var(--muted)"}">${cluster.momentumLabel} ↑</span></div>
        </div>
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:12px;color:var(--ink);line-height:1.6;margin-bottom:12px">${cluster.signal}</div>
        ${cluster.matchedEssays.length ? cluster.matchedEssays.slice(0, 5).map(e => `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);padding:2px 0">· ${(e.title || "").slice(0, 80)}${(e.title || "").length > 80 ? "…" : ""}</div>`).join("") : ""}
        ${cluster.resonantReaders.length ? `<div style="margin-top:8px">${cluster.resonantReaders.slice(0, 5).map(r => `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);padding:2px 0">· ${r.name}${r.followerCount > 0 ? ` — ${r.followerCount.toLocaleString()} followers` : ""}</div>`).join("")}</div>` : ""}
        <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--faint);margin-top:10px">${cluster.evidenceSummary}</div>
        ${cluster.recommendedIntersection ? `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--muted);margin-top:6px">Explore: ${cluster.label} × ${cluster.recommendedIntersection}</div>` : ""}
      </div>`).join("");

  return blindSpotHTML + clusterCardsHTML;
}

async function renderThemeSection(readers, notes) {
  const allComments = readers.flatMap(r => r.comments || []);
  if (!allComments.length) return "";

  const userThemes = await loadUserThemes();
  const clusters   = buildThemeCluster(userThemes, readers, notes || []);
  const blindSpot  = detectEditorialBlindSpot(clusters, notes || []);

  const managerHTML = renderThemeManager(userThemes);
  const innerHTML   = renderThemeSectionInner(clusters, blindSpot);

  return `
    <div class="sh">What your readers are responding to</div>
    ${managerHTML}
    ${userThemes.length > 0 ? `
      <div class="card" style="padding:20px;margin-bottom:28px">
        <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.6">
          Tracking ${allComments.length} comment${allComments.length !== 1 ? "s" : ""} across ${readers.length} reader${readers.length !== 1 ? "s" : ""} against your ${userThemes.length} theme${userThemes.length !== 1 ? "s" : ""}.
        </div>
        <div id="theme-section">${innerHTML}</div>
      </div>` : ""}
  `;
}


// ═══════════════════════════════════════════════════════════════════════════
// BUILD 2 — EDITORIAL INTELLIGENCE UI
// RULE: UI never calculates insights. Receives data from analytics/readers.js
// ═══════════════════════════════════════════════════════════════════════════

function renderRecommendations(recommendations) {
  if (!recommendations || !recommendations.length) return "";

  const icons = {
    editorial:    "✦",
    outreach:     "→",
    attention:    "◎",
    relationship: "↻"
  };

  const labels = {
    editorial:    "Write this next",
    outreach:     "Reach out today",
    attention:    "Notice this pattern",
    relationship: "Re-engage"
  };

  const colors = {
    editorial:    "#7a9e8e",
    outreach:     "#c4956a",
    attention:    "#7b8fa8",
    relationship: "#a08ab0"
  };

  const cardsHTML = recommendations.map(rec => `
    <div class="rec-card">
      <div class="rec-header">
        <span class="rec-icon" style="color:${colors[rec.type]}">${icons[rec.type]}</span>
        <span class="rec-label" style="color:${colors[rec.type]}">${labels[rec.type]}</span>
      </div>
      <div class="rec-text">${rec.text}</div>
    </div>`).join("");

  return `
    <div class="sh">What to do next</div>
    <div class="rec-grid">${cardsHTML}</div>
  `;
}

function renderOutreachSignal(candidates) {
  if (!candidates || !candidates.length) return "";

  const cardsHTML = candidates.map(r => {
    const latestComment = r.comments && r.comments[0];
    return `
      <div class="outreach-card">
        <div class="outreach-top">
          <div class="reader-avatar" style="background:${avatarColor(r.handle).bg};color:${avatarColor(r.handle).text}">
            ${initials(r.name)}
          </div>
          <div class="outreach-meta">
            <div class="outreach-name">${r.name}</div>
            <div class="outreach-sub">@${r.handle}${r.followerCount > 0 ? ` · ${r.followerCount.toLocaleString()} followers` : ""} · ${r.commentCount} comments</div>
          </div>
        </div>
        ${latestComment && latestComment.text ? `
          <div class="outreach-quote">"${latestComment.text.slice(0, 120)}${latestComment.text.length > 120 ? "…" : ""}"</div>
        ` : ""}
        <div class="outreach-reason">${r.outreachReason}</div>
      </div>`;
  }).join("");

  return `
    <div class="sh">Worth reaching out to</div>
    <div style="margin-bottom:28px">${cardsHTML}</div>
  `;
}

function renderRelationshipIntelligence(cohorts) {
  if (!cohorts) return "";
  const { loyal, emerging, fading } = cohorts;
  if (!loyal.length && !emerging.length && !fading.length) return "";

  const pillHTML = (readers, color) => readers.map(r => `
    <div class="rel-pill">
      <div class="silent-avatar" style="background:${avatarColor(r.handle).bg};color:${avatarColor(r.handle).text}">
        ${initials(r.name)}
      </div>
      <div>
        <div class="rel-name">${r.name}</div>
        <div class="rel-note" style="color:${color}">${r.relationshipLabel}</div>
      </div>
      <div class="rel-count">${r.commentCount}×</div>
    </div>`).join("");

  const sections = [];

  if (loyal.length) {
    sections.push(`
      <div class="rel-section">
        <div class="rel-section-label" style="color:#7a9e8e">Loyal — keep the relationship warm</div>
        <div class="rel-pills">${pillHTML(loyal, "#7a9e8e")}</div>
      </div>`);
  }

  if (emerging.length) {
    sections.push(`
      <div class="rel-section">
        <div class="rel-section-label" style="color:#c4956a">Emerging — don't let this cool</div>
        <div class="rel-pills">${pillHTML(emerging, "#c4956a")}</div>
      </div>`);
  }

  if (fading.length) {
    sections.push(`
      <div class="rel-section">
        <div class="rel-section-label" style="color:#a08ab0">Fading — worth re-engaging</div>
        <div class="rel-pills">${pillHTML(fading, "#a08ab0")}</div>
      </div>`);
  }

  return `
    <div class="sh">Relationship map</div>
    <div class="card" style="padding:20px;margin-bottom:28px">
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:13px;color:var(--muted);margin-bottom:16px;line-height:1.6">
        Consistency over time — not comment count. Eight comments across twelve posts is loyalty. Eight comments on one post is a spike.
      </div>
      ${sections.join("")}
    </div>
  `;
}

async function renderReadersData(data, notesData, entries) {
  const readers = data.readers || [];
  const userThemes = await Storage.getThemes();
  if (!readers.length) {
    return `
      <div class="readers-scraper-box">
        <div class="scraper-title">No comments found yet</div>
        <div class="scraper-sub" style="margin-bottom:16px">The scan ran but found no comments on your notes. This can happen if your notes have no replies yet, or if the API returned a different format. Try rescanning — the endpoint detection will try multiple patterns.</div>
        <button class="scrape-btn" id="readers-scan-btn">Rescan</button>
        <div class="progress-area" id="readers-progress"></div>
      </div>`;
  }

  const top10 = readers.slice(0, 10);
  const maxScore = top10[0]?.engagementScore || 1;

  // Rising readers — active in last 14 days with 2+ comments
  const rising = top10.filter(r => isRising(r, readers));

  // Silent loyalists — readers with only likes (comment count 0 but appeared somehow)
  // Since we only track commenters, show lowest-comment high-frequency readers as "quiet"
  const quiet = readers.filter(r => r.commentCount === 1).slice(0, 6);

  const scrapedDate = new Date(data.scrapedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const readerCardsHTML = top10.map((reader, i) => {
    const color = avatarColor(reader.handle);
    const barHeight = Math.max(Math.round((reader.engagementScore / maxScore) * 48), 6);
    const barColor = i === 0 ? "#1D9E75" : i === 1 ? "#534AB7" : i === 2 ? "#BA7517" : "#b0aa9e";
    const latestComment = reader.comments[0];
    const isRisingReader = isRising(reader, readers);

    return `
      <div class="reader-card">
        <div class="reader-avatar" style="background:${color.bg};color:${color.text}">
          ${initials(reader.name)}
        </div>
        <div class="reader-body">
          <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:2px">
            <div class="reader-name">${reader.name}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--faint);display:flex;align-items:center;gap:6px">
              ${isRisingReader ? `<span class="reader-pill rising">Rising</span>` : ""}
              ${relativeDate(reader.lastSeen)}
            </div>
          </div>
          <div class="reader-handle">@${reader.handle}${reader.followerCount > 0 ? ` · ${reader.followerCount.toLocaleString()} followers` : ""}</div>
          <div class="reader-pills">
            ${reader.commentCount > 0 ? `<span class="reader-pill">${reader.commentCount} comment${reader.commentCount !== 1 ? "s" : ""}</span>` : ""}
            ${reader.restackCount > 0 ? `<span class="reader-pill green">${reader.restackCount} restacks</span>` : ""}
            ${reader.likeCount > 0 ? `<span class="reader-pill">${reader.likeCount} likes</span>` : ""}
          </div>
          ${latestComment && latestComment.text ? `<div class="reader-quote">"${latestComment.text}"${latestComment.postTitle ? `<div class="reader-quote-source">on "${latestComment.postTitle}"</div>` : ""}</div>` : ""}
        </div>
        <div class="reader-score-bar">
          <div class="score-bar-fill" style="height:${barHeight}px;background:${barColor}"></div>
          <div class="score-bar-num">${reader.engagementScore}</div>
        </div>
      </div>`;
  }).join("");

  const quietHTML = quiet.length ? `
    <div class="sh">Quiet returners</div>
    <div class="card" style="padding:16px">
      <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:13px;color:var(--muted);margin-bottom:12px">
        Commented once and came back. They're warming up.
      </div>
      <div class="silent-pills">
        ${quiet.map(r => {
          const color = avatarColor(r.handle);
          return `<div class="silent-pill">
            <div class="silent-avatar" style="background:${color.bg};color:${color.text}">${initials(r.name)}</div>
            <span class="silent-handle">@${r.handle}</span>
            <span class="silent-count">${r.commentCount}×</span>
          </div>`;
        }).join("")}
      </div>
    </div>` : "";

  return `
    <div class="readers-scraper-box" style="text-align:left;padding:18px 22px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:17px;color:var(--ink)">Who keeps showing up</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--faint);margin-top:3px">Last scanned ${scrapedDate} · ${readers.length} unique readers found</div>
        </div>
        <button class="scrape-btn" id="readers-scan-btn">Rescan</button>
      </div>
      <div class="progress-area" id="readers-progress"></div>
    </div>

    <div class="stats-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-cell"><div class="stat-big">${readers.length}</div><div class="stat-label">Readers</div></div>
      <div class="stat-cell"><div class="stat-big">${readers.filter(r => r.commentCount >= 3).length}</div><div class="stat-label">Loyal (3+ times)</div></div>
      <div class="stat-cell"><div class="stat-big">${rising.length}</div><div class="stat-label">Rising</div></div>
      <div class="stat-cell"><div class="stat-big">${readers.filter(r => r.followerCount > 1000).length}</div><div class="stat-label">High reach</div></div>
    </div>

    ${renderRecommendations(generateRecommendations(userThemes, readers, entries || [], notesData ? notesData.notes || [] : []))}

    ${renderOutreachSignal(identifyOutreachCandidates(readers))}

    ${renderRelationshipIntelligence(identifyRelationshipDepth(readers, 0))}

    <div class="sh">Top resonators</div>
    ${readerCardsHTML}

    ${quietHTML}

    ${await renderThemeSection(readers, notesData ? notesData.notes || [] : [])}

    <div style="text-align:center;margin-top:16px;font-family:'DM Mono',monospace;font-size:10px;color:var(--faint)">
      Score: comment × 2 · restack × 3 · like × 1 · based on public engagement only
    </div>
  `;
}

function attachReadersScanBtn(notesData) {
  const btn = document.getElementById("readers-scan-btn");
  const progress = document.getElementById("readers-progress");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    if (!notesData || !notesData.notes?.length) return;
    btn.disabled = true;
    progress.innerHTML = `<div class="progress-msg">Starting scan…</div><div class="progress-bar-track"><div class="progress-bar-fill" id="readers-fill" style="width:5%"></div></div>`;

    const fill = () => document.getElementById("readers-fill");

    try {
      const { handle: authorHandle } = await Storage.getSettings();
      console.log('Handle at scrape time:', authorHandle);
      const result = await scrapeReaders(notesData.notes, ({ stage, message, scanned, total }) => {
        const msg = document.querySelector(".progress-msg");
        if (msg) msg.textContent = message;
        if (fill()) {
          if (stage === "scanning") fill().style.width = Math.min(10 + (scanned / total) * 60, 70) + "%";
          else if (stage === "profiling") fill().style.width = Math.min(70 + (scanned / total) * 25, 95) + "%";
          else if (stage === "done") fill().style.width = "100%";
        }
      }, authorHandle);

      const freshData = await Storage.getReaders();
      document.getElementById("readers-content").innerHTML = await renderReadersData(freshData, notesData);
      attachReadersScanBtn(notesData);
      attachThemeManagerEvents(freshData?.readers || [], freshData?.readers || [], notesData ? notesData.notes || [] : []);

    } catch (err) {
      const msg = err.message || "";
      if (!msg.includes("No posts found") && !msg.includes("substack.com")) {
        progress.innerHTML = `<div class="progress-msg" style="color:#b07070">Error: ${msg}</div>`;
      }
      btn.disabled = false;
    }
  });
}

async function renderReaders(readersData, notesData, entries) {
  const el = document.getElementById("readers-content");
  if (!el) return;

  const hasNotes = notesData && notesData.notes?.length > 0;
  const hasReaders = readersData && readersData.readers?.length > 0;

  if (hasReaders) {
    el.innerHTML = await renderReadersData(readersData, notesData, entries);
    attachReadersScanBtn(notesData);
    attachThemeManagerEvents(readersData.readers || [], readersData.readers || [], notesData ? notesData.notes || [] : []);
  } else if (hasNotes) {
    // Notes exist but no readers scan yet — show scan prompt
    el.innerHTML = renderReadersEmpty(true);
    attachReadersScanBtn(notesData);
    attachThemeManagerEvents([], [], notesData ? notesData.notes || [] : []);
  } else {
    // No notes at all
    el.innerHTML = renderReadersEmpty(false);
  }
}
