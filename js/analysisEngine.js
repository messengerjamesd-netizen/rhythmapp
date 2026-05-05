// analysisEngine.js — compare expected beat timestamps vs actual clap timestamps

const MAX_TOLERANCE_MS = 100; // upper bound; scales down for short notes

/**
 * Per-beat tolerance: min(100ms, 45% of the gap to the nearest neighbour).
 * 45% means two adjacent tolerance bands never overlap (2 × 45% = 90% < 100%).
 */
function beatTolerance(beat, allBeats) {
  let minGap = Infinity;
  allBeats.forEach((other) => {
    if (other !== beat) minGap = Math.min(minGap, Math.abs(other.time - beat.time));
  });
  return Math.min(MAX_TOLERANCE_MS, minGap * 0.45);
}

/**
 * Match each expected beat to the nearest clap (greedy, one-to-one).
 * Returns an array of result objects, one per expected beat.
 */
export function analyzePerformance(expectedBeats, clapTimestamps) {
  const claps = [...clapTimestamps];
  const used  = new Set();

  const results = expectedBeats.map((beat) => {
    const tolerance = beatTolerance(beat, expectedBeats);

    // Find the nearest unused clap
    let bestIdx  = -1;
    let bestDiff = Infinity;
    claps.forEach((clapTime, idx) => {
      if (used.has(idx)) return;
      const diff = clapTime - beat.time; // positive = late, negative = early
      if (Math.abs(diff) < Math.abs(bestDiff)) { bestDiff = diff; bestIdx = idx; }
    });

    // Claim the clap if it's within 4× tolerance (generous search window)
    if (bestIdx !== -1 && Math.abs(bestDiff) <= tolerance * 4) {
      used.add(bestIdx);
      const classification =
        Math.abs(bestDiff) <= tolerance ? "correct" : bestDiff < 0 ? "early" : "late";
      return {
        expected: beat.time,
        actual: claps[bestIdx],
        error: bestDiff,   // ms; negative=early, positive=late
        classification,
        missed: false,
        tolerance,         // per-note, used by timeline renderer
      };
    }

    return {
      expected:       beat.time,
      actual:         null,
      error:          null,
      classification: "missed",
      missed:         true,
      tolerance,
    };
  });

  const correct  = results.filter((r) => r.classification === "correct").length;
  const accuracy = expectedBeats.length > 0
    ? Math.round((correct / expectedBeats.length) * 100) : 0;

  const extraClaps = clapTimestamps.filter((_, idx) => !used.has(idx));

  return { results, accuracy, extraClaps };
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
