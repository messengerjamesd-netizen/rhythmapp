// rhythmEngine.js — rhythm data model and timing conversion

// Built-in rhythm patterns. duration is in beats (1 = quarter note).
export const RHYTHMS = {
  "Quarter Notes": [
    { type: "note", duration: 1 },
    { type: "note", duration: 1 },
    { type: "note", duration: 1 },
    { type: "note", duration: 1 },
  ],
  "Quarter + Eighths": [
    { type: "note", duration: 1 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 1 },
    { type: "note", duration: 1 },
  ],
  "Syncopated": [
    { type: "note", duration: 0.5 },
    { type: "rest", duration: 0.5 },
    { type: "note", duration: 1 },
    { type: "note", duration: 0.5 },
    { type: "rest", duration: 0.5 },
    { type: "note", duration: 1 },
  ],
  "Eighth Note Run": [
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
  ],
  "Dotted Quarter": [
    { type: "note", duration: 1.5 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 1.5 },
    { type: "note", duration: 0.5 },
  ],
  "Mixed with Rests": [
    { type: "note", duration: 1 },
    { type: "rest", duration: 1 },
    { type: "note", duration: 0.5 },
    { type: "note", duration: 0.5 },
    { type: "rest", duration: 0.5 },
    { type: "note", duration: 0.5 },
  ],
};

/**
 * Convert a rhythm pattern + BPM into absolute timestamps (ms from start).
 * Only notes (not rests) produce expected clap events.
 * Returns: { beats: [{time, duration, type, beatIndex}], totalDuration }
 */
export function rhythmToTimestamps(pattern, bpm) {
  const msPerBeat = (60 / bpm) * 1000;
  let cursor = 0;
  const beats = [];

  pattern.forEach((event, i) => {
    if (event.type === "note") {
      beats.push({
        time: cursor,             // ms from sequence start when clap is expected
        duration: event.duration * msPerBeat,
        type: event.type,
        beatIndex: i,
      });
    }
    cursor += event.duration * msPerBeat;
  });

  return { beats, totalDuration: cursor };
}

/**
 * Returns total beat count (sum of durations) for a pattern.
 * Used to set up the metronome grid.
 */
export function totalBeats(pattern) {
  return pattern.reduce((sum, e) => sum + e.duration, 0);
}
