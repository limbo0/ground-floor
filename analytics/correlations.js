// analytics/correlations.js
// Pure analytics functions — Data → Insight
// RULE: Never touches the DOM. No document, no innerHTML, no rendering.

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
