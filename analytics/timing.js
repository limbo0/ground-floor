// analytics/timing.js
// Pure analytics functions — Data → Insight
// RULE: Never touches the DOM. No document, no innerHTML, no rendering.
// Build 3 — Commenter Timing Analysis

// ── Configuration ─────────────────────────────────────────────────────────
const TIMING_CONFIG = {
  minComments: 3,    // minimum total comments needed for meaningful timing data
  minReaders:  2,    // minimum readers needed
};

// ── Time of day helpers ───────────────────────────────────────────────────
function getTimeSegment(hour) {
  if (hour >= 5  && hour < 9)  return "Early morning";
  if (hour >= 9  && hour < 12) return "Morning";
  if (hour >= 12 && hour < 14) return "Midday";
  if (hour >= 14 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 20) return "Evening";
  if (hour >= 20 && hour < 23) return "Night";
  return "Late night";
}

function hourToLabel(hour) {
  const d = new Date(0, 0, 0, hour);
  return d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
}

// ── Core analysis ─────────────────────────────────────────────────────────
// Takes readers array (from scraper) and notes array.
// Returns timing intelligence — when engaged readers are most active.

function analyseCommenterTiming(readers) {
  if (!readers || readers.length < TIMING_CONFIG.minReaders) return null;

  // Collect all comment timestamps from all readers
  const allComments = readers.flatMap(r => r.comments || []);
  if (allComments.length < TIMING_CONFIG.minComments) return null;

  // Hour distribution
  const hourCounts = {};
  const segmentCounts = {};
  const dayOfWeekCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
  const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  allComments.forEach(comment => {
    if (!comment.date) return;
    const d    = new Date(comment.date);
    const hour = d.getHours();
    const day  = d.getDay();
    const seg  = getTimeSegment(hour);

    hourCounts[hour]   = (hourCounts[hour]   || 0) + 1;
    segmentCounts[seg] = (segmentCounts[seg] || 0) + 1;
    dayOfWeekCounts[day]++;
  });

  // Find peak hour
  const peakHourEntry = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const peakHour = peakHourEntry ? parseInt(peakHourEntry[0]) : null;

  // Find peak segment
  const peakSegEntry = Object.entries(segmentCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const peakSegment = peakSegEntry ? peakSegEntry[0] : null;

  // Find peak day
  const peakDayEntry = Object.entries(dayOfWeekCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const peakDay = peakDayEntry ? DAY_NAMES[parseInt(peakDayEntry[0])] : null;

  // Top 3 hours
  const topHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h, count]) => ({
      hour: parseInt(h),
      label: hourToLabel(parseInt(h)),
      segment: getTimeSegment(parseInt(h)),
      count
    }));

  // Day distribution for display
  const dayDistribution = Object.entries(dayOfWeekCounts)
    .map(([day, count]) => ({
      day: DAY_NAMES[parseInt(day)],
      short: DAY_NAMES[parseInt(day)].slice(0, 3),
      count
    }));

  // Generate insight
  let insight = "";
  if (peakSegment && peakDay) {
    insight = `Your engaged readers are most active during ${peakSegment.toLowerCase()} on ${peakDay}s.`;
  }

  // Generate recommendation
  let recommendation = "";
  if (peakHour !== null) {
    recommendation = `Publishing around ${hourToLabel(peakHour)} on ${peakDay}s puts your notes in front of your most engaged readers at their most active moment.`;
  }

  return {
    totalComments:    allComments.length,
    peakHour,
    peakHourLabel:    peakHour !== null ? hourToLabel(peakHour) : "—",
    peakSegment,
    peakDay,
    topHours,
    dayDistribution,
    segmentCounts,
    insight,
    recommendation
  };
}

// ── Gap analysis ──────────────────────────────────────────────────────────
// Compares when the writer posts vs when their engaged readers are active.
// Identifies the timing gap.

function analyseTimingGap(notes, timingData) {
  if (!notes || !notes.length || !timingData) return null;

  // Find writer's most common posting hour
  const postingHours = notes
    .filter(n => n.hour !== null && n.hour !== undefined)
    .map(n => n.hour);

  if (!postingHours.length) return null;

  const postingHourCounts = {};
  postingHours.forEach(h => {
    postingHourCounts[h] = (postingHourCounts[h] || 0) + 1;
  });

  const writerPeakHourEntry = Object.entries(postingHourCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const writerPeakHour = writerPeakHourEntry
    ? parseInt(writerPeakHourEntry[0]) : null;

  if (writerPeakHour === null || timingData.peakHour === null) return null;

  const gapHours = Math.abs(timingData.peakHour - writerPeakHour);
  const alignmentGap = Math.min(gapHours, 24 - gapHours); // circular hour distance

  const writerSegment = getTimeSegment(writerPeakHour);
  const readerSegment = timingData.peakSegment;

  let gapSignal = "";
  if (alignmentGap <= 2) {
    gapSignal = `Your posting time (${hourToLabel(writerPeakHour)}) aligns well with when your engaged readers are most active (${timingData.peakHourLabel}). Good timing.`;
  } else if (alignmentGap <= 5) {
    gapSignal = `You post most often at ${hourToLabel(writerPeakHour)} but your engaged readers are most active at ${timingData.peakHourLabel}. A small shift could improve early engagement.`;
  } else {
    gapSignal = `There's a ${alignmentGap}-hour gap between when you post (${hourToLabel(writerPeakHour)}) and when your engaged readers are most active (${timingData.peakHourLabel}). Your notes may be landing before your best readers arrive.`;
  }

  return {
    writerPeakHour,
    writerPeakHourLabel: hourToLabel(writerPeakHour),
    writerSegment,
    readerPeakHour:      timingData.peakHour,
    readerPeakHourLabel: timingData.peakHourLabel,
    readerSegment,
    alignmentGap,
    gapSignal,
    wellAligned: alignmentGap <= 2
  };
}
