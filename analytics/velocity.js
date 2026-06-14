// analytics/velocity.js
// Pure analytics functions — Data → Insight
// RULE: Never touches the DOM. No document, no innerHTML, no rendering.
// Build 3 — Engagement Velocity

// ── Configuration ─────────────────────────────────────────────────────────
const VELOCITY_CONFIG = {
  resurgenceThreshold:  0.20,  // 20% growth since last scrape = resurging
  significantGrowth:    0.50,  // 50% growth = significant signal
  recentWindowHours:    48,    // hours to consider "recent" activity
  minLikesForSignal:    3,     // minimum likes before flagging (avoid noise)
  maxResurgingNotes:    3,     // max notes to surface at once
};

// ── Snapshot comparison ───────────────────────────────────────────────────
// Called with current notes array and previous snapshot array.
// Returns notes that have grown significantly since last scrape.

function detectResurgingNotes(currentNotes, previousSnapshot) {
  if (!currentNotes || !currentNotes.length) return [];
  if (!previousSnapshot || !previousSnapshot.length) return [];

  // Build lookup map from previous snapshot by note ID
  const prevMap = {};
  previousSnapshot.forEach(n => { prevMap[n.id] = n; });

  const resurging = [];

  currentNotes.forEach(note => {
    const prev = prevMap[note.id];
    if (!prev) return; // New note — no baseline to compare

    const prevLikes    = prev.likes    || 0;
    const prevRestacks = prev.restacks || 0;
    const currentLikes    = note.likes    || 0;
    const currentRestacks = note.restacks || 0;

    // Skip notes with too few likes to be meaningful
    if (currentLikes < VELOCITY_CONFIG.minLikesForSignal) return;

    // Calculate growth
    const likesGrowth    = prevLikes > 0
      ? (currentLikes - prevLikes) / prevLikes
      : currentLikes > 0 ? 1 : 0;

    const restackGrowth  = prevRestacks > 0
      ? (currentRestacks - prevRestacks) / prevRestacks
      : currentRestacks > 0 ? 1 : 0;

    const likesDelta    = currentLikes    - prevLikes;
    const restacksDelta = currentRestacks - prevRestacks;

    // Flag if meaningful growth detected
    const isResurging = likesGrowth >= VELOCITY_CONFIG.resurgenceThreshold ||
                        restacksDelta >= 2;

    if (!isResurging) return;

    // Determine age of note
    const noteDate = note.date ? new Date(note.date) : null;
    const ageMs    = noteDate ? Date.now() - noteDate.getTime() : 0;
    const ageDays  = Math.round(ageMs / 86400000);

    // Generate signal strength
    const isSignificant = likesGrowth >= VELOCITY_CONFIG.significantGrowth ||
                          restacksDelta >= 5;

    // Generate plain-English reason
    let reason = "";
    if (restacksDelta >= 2 && likesDelta >= 5) {
      reason = `Gained ${likesDelta} likes and ${restacksDelta} restacks since last check. Someone with reach is amplifying it.`;
    } else if (restacksDelta >= 2) {
      reason = `${restacksDelta} new restacks since last check. It's being shared again.`;
    } else if (likesDelta >= 10) {
      reason = `${likesDelta} new likes since last check — well above its original pace.`;
    } else {
      reason = `Engagement has picked up since last check — ${likesDelta} new likes.`;
    }

    resurging.push({
      id:           note.id,
      bodyPreview:  note.bodyPreview || "",
      date:         note.date,
      dateLabel:    note.dateLabel || "",
      ageDays,
      url:          note.url || "",
      currentLikes,
      currentRestacks,
      likesDelta,
      restacksDelta,
      likesGrowth:  +likesGrowth.toFixed(2),
      isSignificant,
      reason,
      signal:       isSignificant ? "strong" : "moderate"
    });
  });

  return resurging
    .sort((a, b) => b.likesDelta - a.likesDelta)
    .slice(0, VELOCITY_CONFIG.maxResurgingNotes);
}

// ── Overall engagement velocity ───────────────────────────────────────────
// How is engagement trending across all notes over time?

function calculateOverallVelocity(currentNotes, previousSnapshot) {
  if (!currentNotes || !previousSnapshot) return null;
  if (!currentNotes.length || !previousSnapshot.length) return null;

  const prevMap = {};
  previousSnapshot.forEach(n => { prevMap[n.id] = n; });

  let totalLikesDelta    = 0;
  let totalRestacksDelta = 0;
  let notesCompared      = 0;

  currentNotes.forEach(note => {
    const prev = prevMap[note.id];
    if (!prev) return;
    totalLikesDelta    += (note.likes    || 0) - (prev.likes    || 0);
    totalRestacksDelta += (note.restacks || 0) - (prev.restacks || 0);
    notesCompared++;
  });

  if (!notesCompared) return null;

  const direction = totalLikesDelta > 0 ? "up"
    : totalLikesDelta < 0 ? "down" : "flat";

  let trend = "";
  if (direction === "up" && totalLikesDelta >= 20) {
    trend = `Engagement is up across your notes — ${totalLikesDelta} new likes since last check.`;
  } else if (direction === "up") {
    trend = `Steady engagement growth — ${totalLikesDelta} new likes across your notes.`;
  } else if (direction === "down") {
    trend = `Engagement has dipped slightly since last check. Normal variation unless it persists.`;
  } else {
    trend = `Engagement is stable since last check.`;
  }

  return {
    totalLikesDelta,
    totalRestacksDelta,
    notesCompared,
    direction,
    trend
  };
}

// ── Load and save snapshot ────────────────────────────────────────────────
// These are data-layer helpers — they use Storage but don't touch DOM

function saveEngagementSnapshot(notes) {
  const snapshot = notes.map(n => ({
    id:       n.id,
    likes:    n.likes    || 0,
    restacks: n.restacks || 0,
    replies:  n.replies  || 0,
    views:    n.views    || 0,
    savedAt:  new Date().toISOString()
  }));
  return Storage.set("gf_notes_snapshot", snapshot);
}

function loadEngagementSnapshot() {
  return Storage.get("gf_notes_snapshot");
}
