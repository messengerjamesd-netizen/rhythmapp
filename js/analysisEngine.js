// analysisEngine.js — compare expected beat timestamps vs actual clap timestamps

const TOLERANCE_MS = 100; // ±100ms counts as "correct"

/**
 * Match each expected beat to the nearest clap (greedy, one-to-one).
 * Returns an array of result objects, one per expected beat.
 */
export function analyzePerformance(expectedBeats, clapTimestamps) {
  // Work with copies so we don't mutate
  const claps = [...clapTimestamps];
  const used = new Set();

  const results = expectedBeats.map((beat) => {
    // Find the nearest unused clap to this expected beat
    let bestIdx = -1;
    let bestDiff = Infinity;

    claps.forEach((clapTime, idx) => {
      if (used.has(idx)) return;
      const diff = clapTime - beat.time; // positive = late, negative = early
      if (Math.abs(diff) < Math.abs(bestDiff)) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });

    // Only claim this clap if it's within a reasonable window (2× tolerance)
    if (bestIdx !== -1 && Math.abs(bestDiff) <= TOLERANCE_MS * 4) {
      used.add(bestIdx);
      const classification =
        Math.abs(bestDiff) <= TOLERANCE_MS
          ? "correct"
          : bestDiff < 0
          ? "early"
          : "late";
      return {
        expected: beat.time,
        actual: claps[bestIdx],
        error: bestDiff,        // ms; negative=early, positive=late
        classification,
        missed: false,
      };
    }

    // No clap found near this beat
    return {
      expected: beat.time,
      actual: null,
      error: null,
      classification: "missed",
      missed: true,
    };
  });

  // Accuracy = correct / total expected notes
  const correct = results.filter((r) => r.classification === "correct").length;
  const accuracy = expectedBeats.length > 0
    ? Math.round((correct / expectedBeats.length) * 100)
    : 0;

  // Extra claps (false positives) — claps with no matching expected beat
  const extraClaps = clapTimestamps.filter((_, idx) => !used.has(idx));

  return { results, accuracy, extraClaps, toleranceMs: TOLERANCE_MS };
}

/**
 * Human-readable grade label from accuracy percentage.
 */
export function gradeLabel(accuracy) {
  if (accuracy >= 90) return "Excellent!";
  if (accuracy >= 75) return "Good";
  if (accuracy >= 50) return "Keep Practicing";
  return "Needs Work";
}
