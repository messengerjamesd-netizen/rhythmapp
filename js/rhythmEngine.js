// rhythmEngine.js — timing conversion from rhythm patterns to millisecond timestamps

export { RHYTHM_LIBRARY, findRhythm, defaultRhythm } from "./rhythmLibrary.js";

/**
 * Convert a rhythm pattern + BPM into absolute timestamps (ms from start).
 * Only notes (not rests) produce expected clap events.
 */
export function rhythmToTimestamps(pattern, bpm) {
  const msPerBeat = (60 / bpm) * 1000;
  let cursor = 0;
  const beats = [];

  pattern.forEach((event, i) => {
    if (event.type === "note") {
      beats.push({
        time: cursor,
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
 * Returns total quarter-note beat count for a pattern (sum of all durations).
 */
export function totalBeats(pattern) {
  return pattern.reduce((sum, e) => sum + e.duration, 0);
}
