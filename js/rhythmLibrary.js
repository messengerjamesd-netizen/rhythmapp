// rhythmLibrary.js — categorized rhythm patterns with time signatures
// duration is in beats (1 = quarter note).  Tempo-independent until conversion.

export const RHYTHM_LIBRARY = {
  "Beginner": [
    {
      name: "Quarter Notes",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "Whole Note",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 4 },
      ],
    },
    {
      name: "Two Halves",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 2 },
        { type: "note", duration: 2 },
      ],
    },
    {
      name: "Half & Quarters",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 2 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "Quarters & Half",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
        { type: "note", duration: 2 },
      ],
    },
    {
      name: "Waltz",
      timeSig: { beats: 3, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "Waltz Half",
      timeSig: { beats: 3, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "note", duration: 2 },
      ],
    },
  ],

  "Intermediate": [
    {
      // Classic Kodaly: Ta Ti-Ti Ta Ta
      name: "Ta Ti-Ti",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "All Eighths",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
      ],
    },
    {
      name: "Dotted Quarter",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 1.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 1.5 },
        { type: "note", duration: 0.5 },
      ],
    },
    {
      name: "Quarter Rest",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "rest", duration: 1 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "Eighth Rest",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "rest", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "Waltz Eighths",
      timeSig: { beats: 3, value: 4 },
      pattern: [
        { type: "note", duration: 1 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 1 },
      ],
    },
    {
      name: "2/4 March",
      timeSig: { beats: 2, value: 4 },
      pattern: [
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
      ],
    },
  ],

  "Advanced": [
    {
      // Off-beat syncopation: eighth rest, quarter, quarter, quarter, eighth
      name: "Syncopated",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "rest",  duration: 0.5 },
        { type: "note",  duration: 1 },
        { type: "note",  duration: 1 },
        { type: "note",  duration: 1 },
        { type: "note",  duration: 0.5 },
      ],
    },
    {
      // Typical Latin/pop syncopation
      name: "Off-Beat Eighth",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 0.5 },
        { type: "rest", duration: 0.5 },
        { type: "note", duration: 1 },
        { type: "note", duration: 0.5 },
        { type: "rest", duration: 0.5 },
        { type: "note", duration: 1 },
      ],
    },
    {
      // Four groups of: dotted quarter + eighth
      name: "Dotted Eighth",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 0.75 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.75 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.75 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.75 },
        { type: "note", duration: 0.25 },
      ],
    },
    {
      // Sixteenth note groups: two groups of four sixteenths per half-bar
      name: "Sixteenths",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 1 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 1 },
      ],
    },
    {
      // Mixed sixteenths: eighth + two sixteenths pattern (×4)
      name: "Eighth + Sixteenths",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.25 },
        { type: "note", duration: 0.25 },
      ],
    },
    {
      // 3+3+2 feel (clave-like): three eighths, three eighths, two eighths
      name: "3+3+2 Feel",
      timeSig: { beats: 4, value: 4 },
      pattern: [
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
        { type: "note", duration: 0.5 },
      ],
    },
  ],
};

// Flat lookup by name for use in app state
export function findRhythm(name) {
  for (const category of Object.values(RHYTHM_LIBRARY)) {
    const found = category.find((r) => r.name === name);
    if (found) return found;
  }
  return null;
}

// First rhythm in the library (default selection)
export function defaultRhythm() {
  return Object.values(RHYTHM_LIBRARY)[0][0];
}
