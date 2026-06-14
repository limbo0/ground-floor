// analytics/themes.js
// Pure analytics functions — Data → Insight
// RULE: Never touches the DOM. No document, no innerHTML, no rendering.
// Note: loadUserThemes and saveUserThemes use Storage — acceptable as
// they are data-layer functions, not UI functions.

const THEME_PALETTE = [
  { color: "#7b8fa8", bg: "#eef1f5" },
  { color: "#7a9e8e", bg: "#eef4f1" },
  { color: "#c4956a", bg: "#f9f3ec" },
  { color: "#a08ab0", bg: "#f2eef8" },
  { color: "#b07070", bg: "#f5eeee" }
];

// Load user themes from storage
function loadUserThemes() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["gf_themes"], (r) => {
      resolve(r.gf_themes || []);
    });
  });
}

// Save user themes to storage
function saveUserThemes(themes) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ gf_themes: themes }, resolve);
  });
}

// Extract themes from comments using user-defined themes
function extractThemes(allComments, userThemes) {
  if (!allComments.length || !userThemes.length) return [];

  const results = userThemes.map((theme, i) => {
    const palette = THEME_PALETTE[i % THEME_PALETTE.length];
    const keywords = (theme.keywords || "")
      .toLowerCase()
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    // Also use theme name itself as a keyword
    if (theme.name) keywords.push(theme.name.toLowerCase());

    const matchedComments = [];
    let count = 0;

    allComments.forEach(comment => {
      const rawText = comment.commentText || comment.text || "";
      const text = rawText.toLowerCase();
      if (!text) return;
      const matched = keywords.some(kw => kw && text.includes(kw));
      if (matched) {
        count++;
        if (matchedComments.length < 2) matchedComments.push(rawText);
      }
    });

    return {
      id: theme.id,
      label: theme.name,
      color: palette.color,
      bg: palette.bg,
      keywords,
      count,
      topComments: matchedComments
    };
  });

  return results.filter(t => t.count > 0).sort((a, b) => b.count - a.count);
}

function buildThemeCluster(userThemes, readers, notes) {
  if (!userThemes.length) return [];

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const strengthRank = { "Very High": 0, "High": 1, "Medium": 2, "Low": 3 };

  const clusters = userThemes.map(theme => {
    const keywords = (theme.keywords || "")
      .toLowerCase()
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);
    if (theme.name) keywords.push(theme.name.toLowerCase());

    // 1. Matched essays — notes whose bodyPreview hits any keyword
    const matchedEssays = (notes || [])
      .filter(n => keywords.some(kw => kw && (n.bodyPreview || "").toLowerCase().includes(kw)))
      .map(n => ({ title: n.bodyPreview, date: n.date }));

    const matchedTitles = new Set(matchedEssays.map(e => e.title));

    // 2. Resonant readers — commented on a matched essay or whose comment text hits keywords
    const resonantReaders = [];
    const recurringReaderNames = [];
    readers.forEach(r => {
      const themeComments = (r.comments || []).filter(c =>
        (c.postTitle && matchedTitles.has(c.postTitle)) ||
        keywords.some(kw => kw && (c.commentText || c.text || "").toLowerCase().includes(kw))
      );
      if (!themeComments.length) return;
      resonantReaders.push({ name: r.name, followerCount: r.followerCount || 0, commentCount: themeComments.length });
      if (themeComments.length >= 2) recurringReaderNames.push(r.name);
    });

    // 3. Strength — essays, unique resonant readers, distinct months (recurring readers don't count here)
    const essayCount  = matchedEssays.length;
    const readerCount = resonantReaders.length;
    const months = new Set(
      matchedEssays.filter(e => e.date).map(e => new Date(e.date).toISOString().slice(0, 7))
    );
    const monthCount = months.size;

    let strengthLabel;
    if (essayCount >= 5 || readerCount >= 4 || monthCount >= 4) strengthLabel = "Very High";
    else if (essayCount >= 3 || readerCount >= 3 || monthCount >= 3) strengthLabel = "High";
    else if (essayCount >= 2 || readerCount >= 2) strengthLabel = "Medium";
    else strengthLabel = "Low";

    // 4. Momentum — essays for essay counts; reader comments contribute to direction only
    const recentEssays = matchedEssays.filter(e => e.date && (now - new Date(e.date).getTime()) <= thirtyDays);
    const olderEssays  = matchedEssays.filter(e => e.date && (now - new Date(e.date).getTime()) >  thirtyDays);
    const appearsInLast2 = (notes || []).slice(0, 2).some(n =>
      keywords.some(kw => kw && (n.bodyPreview || "").toLowerCase().includes(kw))
    );

    let momentumLabel;
    if (recentEssays.length > olderEssays.length && appearsInLast2) momentumLabel = "Compounding";
    else if (recentEssays.length > 0 && olderEssays.length === 0) momentumLabel = "Emerging";
    else if (olderEssays.length > 0 && recentEssays.length === 0) momentumLabel = "Fading";
    else momentumLabel = "Strong";

    // 5. Signal sentence — editorial tone, named readers where available
    const named = resonantReaders.slice(0, 2).map(r => r.name);
    let signal;
    if (named.length >= 2) {
      signal = `${theme.name} continues to appear across your recent work. ${named[0]} and ${named[1]} consistently return when you explore this territory. There may be more here than you've fully unpacked.`;
    } else if (named.length === 1) {
      signal = `${theme.name} keeps surfacing in your writing. ${named[0]} has shown up more than once in this territory — worth paying attention to.`;
    } else if (essayCount > 0) {
      signal = `${theme.name} threads through ${essayCount} piece${essayCount !== 1 ? "s" : ""} of yours. No readers have surfaced yet, but the writing is already finding a shape.`;
    } else {
      signal = `${theme.name} hasn't matched any recent work yet. Try expanding the keywords or revisit after you post more.`;
    }

    return {
      label: theme.name,
      keywords,
      strengthLabel,
      momentumLabel,
      matchedEssays,
      resonantReaders,
      recurringReaders: recurringReaderNames,
      evidenceSummary: `${essayCount} essay${essayCount !== 1 ? "s" : ""} · ${resonantReaders.length} resonant reader${resonantReaders.length !== 1 ? "s" : ""} · ${monthCount} month${monthCount !== 1 ? "s" : ""} active`,
      signal,
      recommendedIntersection: null
    };
  });

  // 6. recommendedIntersection — highest-strength other cluster whose keywords never co-appear in any note
  clusters.forEach((cluster, i) => {
    const candidate = clusters
      .filter((_, j) => j !== i)
      .sort((a, b) => strengthRank[a.strengthLabel] - strengthRank[b.strengthLabel])
      .find(other => !(notes || []).some(n => {
        const text = (n.bodyPreview || "").toLowerCase();
        return cluster.keywords.some(kw => kw && text.includes(kw)) &&
               other.keywords.some(kw => kw && text.includes(kw));
      }));
    if (candidate) cluster.recommendedIntersection = candidate.label;
  });

  return clusters;
}

function detectEditorialBlindSpot(clusters, notes) {
  if (!clusters.length) return null;

  // Loyalty theme: most recurring readers
  const loyaltyCluster = [...clusters].sort((a, b) => b.recurringReaders.length - a.recurringReaders.length)[0];
  if (!loyaltyCluster.recurringReaders.length) return null;

  // Drift theme: keywords appear most in the last 5 notes
  const last5 = (notes || []).slice(0, 5);
  let driftCluster = null;
  let maxMatches = 0;
  clusters.forEach(c => {
    const matches = last5.filter(n =>
      c.keywords.some(kw => kw && (n.bodyPreview || "").toLowerCase().includes(kw))
    ).length;
    if (matches > maxMatches) { maxMatches = matches; driftCluster = c; }
  });

  if (!driftCluster || loyaltyCluster.label === driftCluster.label) return null;

  return {
    blindSpotThemeA: loyaltyCluster.label,
    blindSpotThemeB: driftCluster.label,
    statement: `Your most loyal readers are attached to ${loyaltyCluster.label}. Your recent writing is drifting toward ${driftCluster.label}. You have not explored the intersection directly. Write there next.`
  };
}

function buildEditorialSignal(themes, readers) {
  if (!themes.length) return [];

  const top = themes[0];
  const second = themes[1];
  const signals = [];

  if (top.count >= 1) {
    signals.push(`"${top.label}" is your strongest resonance theme — appearing in ${top.count} comment${top.count !== 1 ? "s" : ""}. Your readers respond most when you write in this territory.`);
  }

  if (second && second.count >= 1) {
    signals.push(`"${second.label}" surfaces as a strong secondary theme. Consider writing at the intersection of ${top.label} and ${second.label}.`);
  }

  // Reach signal
  const highReach = readers.filter(r => r.followerCount >= 300);
  if (highReach.length) {
    const hrThemeLabels = new Set();
    highReach.forEach(r => {
      r.comments.forEach(c => {
        const text = (c.text || "").toLowerCase();
        themes.forEach(t => {
          if (t.keywords.some(kw => kw && text.includes(kw))) hrThemeLabels.add(t.label);
        });
      });
    });
    if (hrThemeLabels.size) {
      signals.push(`Your high-reach readers (300+ followers) respond to: ${[...hrThemeLabels].slice(0, 2).join(" and ")}. Writing more here may drive restacks.`);
    }
  }

  // Top reader per theme
  const topReader = readers.find(r =>
    r.comments.some(c => {
      const text = (c.text || "").toLowerCase();
      return top.keywords.some(kw => kw && text.includes(kw));
    })
  );
  if (topReader) {
    signals.push(`${topReader.name} resonates most with "${top.label}". Their comments suggest this writing connects personally.`);
  }

  return signals;
}
