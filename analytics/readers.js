// analytics/readers.js
// Pure analytics functions — Data → Insight
// RULE: Never touches the DOM. No document, no innerHTML, no rendering.
// Build 2 — Editorial Intelligence

// ── Configuration ─────────────────────────────────────────────────────────
// Fixed thresholds for 500-5,000 subscriber range.
// Scales to relative thresholds in Build 5 when reader count > 50.

const OUTREACH_CONFIG = {
  minComments:    2,     // minimum comments to qualify
  minFollowers:   200,   // minimum follower count to qualify
  maxCandidates:  3,     // max readers to surface at once
  risingDays:     14,    // days to consider "recently active"
  loyaltyPosts:   3,     // comments across this many posts = loyal
};

// ── Module 1: Reader Intelligence ─────────────────────────────────────────
// Who matters? Not who commented most — who has depth + reach combined.

function identifyOutreachCandidates(readers) {
  if (!readers || !readers.length) return [];

  return readers
    .filter(r => {
      const hasDepth = r.commentCount >= OUTREACH_CONFIG.minComments;
      const hasReach = r.followerCount >= OUTREACH_CONFIG.minFollowers;
      return hasDepth && hasReach;
    })
    .map(r => {
      // Generate a specific, human reason for each candidate
      let reason = "";
      const isRising = r.comments.some(c => {
        if (!c.date) return false;
        return (Date.now() - new Date(c.date)) < OUTREACH_CONFIG.risingDays * 86400000;
      });

      if (r.commentCount >= 4) {
        reason = `Has commented ${r.commentCount} times. This is a reader who keeps coming back — they deserve a personal response.`;
      } else if (isRising && r.followerCount >= 500) {
        reason = `Recently active with ${r.followerCount.toLocaleString()} followers. A reply now, while the connection is warm, could turn a reader into an advocate.`;
      } else if (r.followerCount >= 1000) {
        reason = `Reaches ${r.followerCount.toLocaleString()} followers. One restack from them is meaningful distribution.`;
      } else {
        reason = `${r.commentCount} comments and ${r.followerCount.toLocaleString()} followers. Engaged and connected — worth a personal reply.`;
      }

      return { ...r, outreachReason: reason };
    })
    .sort((a, b) => {
      // Sort by combined score: depth × reach
      const scoreA = (a.commentCount * 2) + (a.followerCount / 100);
      const scoreB = (b.commentCount * 2) + (b.followerCount / 100);
      return scoreB - scoreA;
    })
    .slice(0, OUTREACH_CONFIG.maxCandidates);
}

// ── Module 2: Relationship Intelligence ──────────────────────────────────
// How strong is the relationship? Consistency over time, not volume.

function identifyRelationshipDepth(readers, totalPosts) {
  if (!readers || !readers.length) return { loyal: [], emerging: [], fading: [] };

  const now = Date.now();
  const thirtyDays  = 30  * 86400000;
  const ninetyDays  = 90  * 86400000;
  const sixMonths   = 180 * 86400000;

  const loyal    = [];
  const emerging = [];
  const fading   = [];

  readers.forEach(r => {
    if (!r.comments || !r.comments.length) return;

    const lastSeen    = r.lastSeen  ? new Date(r.lastSeen).getTime()  : 0;
    const firstSeen   = r.firstSeen ? new Date(r.firstSeen).getTime() : 0;
    const ageMs       = now - firstSeen;
    const daysSinceLast = (now - lastSeen) / 86400000;

    // Loyal — commented 3+ times, relationship older than 30 days, active recently
    if (r.commentCount >= 3 && ageMs > thirtyDays && daysSinceLast < 60) {
      loyal.push({
        ...r,
        relationshipLabel: "Loyal reader",
        relationshipNote: `Has engaged ${r.commentCount} times over ${Math.round(ageMs / 86400000)} days. This is a real relationship.`
      });
    }

    // Emerging — commented 2+ times, recent activity within 14 days
    else if (r.commentCount >= 2 && daysSinceLast < 14) {
      emerging.push({
        ...r,
        relationshipLabel: "Emerging reader",
        relationshipNote: `Commented ${r.commentCount} times recently. The relationship is building — don't let it cool.`
      });
    }

    // Fading — used to engage, gone quiet for 60-180 days
    else if (r.commentCount >= 2 && daysSinceLast >= 60 && daysSinceLast <= 180) {
      fading.push({
        ...r,
        relationshipLabel: "Fading reader",
        relationshipNote: `Last engaged ${Math.round(daysSinceLast)} days ago. They invested in your writing once — worth a specific re-engagement.`
      });
    }
  });

  // Sort each cohort by comment count
  const byCount = (a, b) => b.commentCount - a.commentCount;
  return {
    loyal:    loyal.sort(byCount).slice(0, 5),
    emerging: emerging.sort(byCount).slice(0, 3),
    fading:   fading.sort(byCount).slice(0, 3)
  };
}

// ── Module 3: Theme Intelligence ─────────────────────────────────────────
// What themes consistently outperform? Pattern across posts, not single performance.

function identifyThemePatterns(themes, notes) {
  if (!themes || !themes.length || !notes || !notes.length) return [];

  // For each theme, find notes whose body matches theme keywords
  // and calculate average engagement vs overall average
  const overallAvgLikes = notes.length
    ? notes.reduce((s, n) => s + n.likes, 0) / notes.length
    : 0;

  return themes
    .filter(t => t.count >= 2)
    .map(theme => {
      const keywords = (theme.keywords || []);
      const matchedNotes = notes.filter(n => {
        const body = (n.bodyPreview || "").toLowerCase();
        return keywords.some(kw => kw && body.includes(kw));
      });

      const avgLikes = matchedNotes.length
        ? matchedNotes.reduce((s, n) => s + n.likes, 0) / matchedNotes.length
        : 0;

      const performanceRatio = overallAvgLikes > 0
        ? avgLikes / overallAvgLikes
        : 1;

      return {
        label:          theme.label,
        count:          theme.count,
        matchedNotes:   matchedNotes.length,
        avgLikes:       +avgLikes.toFixed(1),
        performanceRatio: +performanceRatio.toFixed(2),
        outperforms:    performanceRatio > 1.2
      };
    })
    .sort((a, b) => b.performanceRatio - a.performanceRatio);
}

// ── Module 4: Recommendation Engine ──────────────────────────────────────
// What should I do next? One or two specific, actionable directions.
// This is the output of the other three modules combined.

function generateRecommendations(themes, readers, entries, notes) {
  const recommendations = [];

  if (!readers || !readers.length) return recommendations;

  // ── Recommendation 1: Editorial direction from theme performance ──
  if (themes && themes.length && notes && notes.length) {
    const themePatterns = identifyThemePatterns(themes, notes);
    const topTheme      = themePatterns.find(t => t.outperforms);
    const secondTheme   = themePatterns.filter(t => t.outperforms)[1];

    if (topTheme && topTheme.performanceRatio >= 1.2) {
      const pct = Math.round((topTheme.performanceRatio - 1) * 100);
      let rec = `Your "${topTheme.label}" writing generates ${pct}% more engagement than your average. `;
      if (secondTheme) {
        rec += `"${secondTheme.label}" also outperforms. Consider writing at the intersection of these two themes next.`;
      } else {
        rec += `Write more in this territory — your readers are telling you it matters.`;
      }
      recommendations.push({ type: "editorial", priority: 1, text: rec });
    }
  }

  // ── Recommendation 2: Outreach action ──
  const candidates = identifyOutreachCandidates(readers);
  if (candidates.length) {
    const top = candidates[0];
    const latestComment = top.comments && top.comments[0];
    let rec = `Reply personally to ${top.name}`;
    if (latestComment && latestComment.text) {
      rec += ` — they said: "${latestComment.text.slice(0, 80)}${latestComment.text.length > 80 ? "…" : ""}". `;
    } else {
      rec += `. `;
    }
    rec += `${top.commentCount} comments and ${top.followerCount.toLocaleString()} followers makes this one of your highest-leverage relationships.`;
    recommendations.push({ type: "outreach", priority: 2, text: rec });
  }

  // ── Recommendation 3: Emotional intent pattern ──
  if (entries && entries.length >= 5) {
    const intentCounts = {};
    entries.forEach(e => { intentCounts[e.reason] = (intentCounts[e.reason] || 0) + 1; });
    const sorted = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]);
    const compulsive = ["Habit", "Avoiding work", "Loneliness", "Validation"];
    const topIntent  = sorted[0];

    if (topIntent && compulsive.includes(topIntent[0])) {
      const pct = Math.round(topIntent[1] / entries.length * 100);
      recommendations.push({
        type: "attention",
        priority: 3,
        text: `${pct}% of your Substack sessions begin from "${topIntent[0]}." Your most intentional sessions — Curiosity and Inspiration — tend to produce stronger writing. Notice the difference next time you open Substack.`
      });
    }
  }

  // ── Recommendation 4: Relationship action ──
  const { fading } = identifyRelationshipDepth(readers, notes ? notes.length : 0);
  if (fading.length) {
    const top = fading[0];
    recommendations.push({
      type: "relationship",
      priority: 4,
      text: `${top.name} engaged ${top.commentCount} times and has been quiet for ${Math.round((Date.now() - new Date(top.lastSeen)) / 86400000)} days. Share your next post with a personal note — re-engagement at this stage has high conversion to loyal reader.`
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}
