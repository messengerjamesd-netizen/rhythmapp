// staffRenderer.js — draws musical staff notation for a rhythm pattern using Canvas 2D

// ── Constants ───────────────────────────────────────────────────────────────────

const LS = 11;          // line spacing (pixels between staff lines)
const NRX = 6;          // note head ellipse x-radius
const NRY = 4;          // note head ellipse y-radius (tilted slightly)
const HEAD_TILT = -0.2; // radians; gives notes the traditional left-leaning oval
const STEM_H = 3.5 * LS;// stem height in px
const BEAM_W = 4;       // beam thickness px
const BEAM_GAP = 3;     // gap between double beams (sixteenth)
const NOTE_COLOR   = "#dde8f8";
const STAFF_COLOR  = "#6a7f96";
const CLEF_COLOR   = "#8aafd0";
const CANVAS_BG    = "#151821"; // matches .staff-wrap background

// Beamable if duration <= 0.5 (eighth or shorter), OR dotted eighth (0.75) which
// conventionally beams to an adjacent sixteenth to complete the beat.
const isBeamable = (d) => d <= 0.5 || Math.abs(d - 0.75) < 0.001;

// Known dotted durations and their base values
const DOTTED = new Map([
  [0.375, 0.25],  // dotted sixteenth
  [0.75,  0.5],   // dotted eighth
  [1.5,   1],     // dotted quarter
  [3,     2],     // dotted half
]);

// ── Bravura music font (SMuFL) ────────────────────────────────────────────────

// 4 * LS matches the VexFlow-packaged Bravura's effective glyph scaling
const BRAVURA_SIZE = 4 * LS; // 44 px for LS=11

const GLYPH_REST_QUARTER   = '';
const GLYPH_REST_EIGHTH    = '';
const GLYPH_REST_SIXTEENTH = '';

let _bravuraLoaded = false;

// Load once at module init; callers can await bravuraReady before first render
export const bravuraReady = (async () => {
  try {
    const face = new FontFace(
      'Bravura',
      "url('/fonts/bravura.woff2')",
    );
    await face.load();
    document.fonts.add(face);
    _bravuraLoaded = true;
  } catch {
    // Font unavailable — bezier fallback used instead
  }
})();

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Render notation onto `canvas` for the given pattern and time signature.
 * Call this whenever the pattern or BPM changes.
 */
export function renderStaff(canvas, pattern, timeSig = { beats: 4, value: 4 }) {
  // ── Hi-DPI setup ──
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.parentElement ? canvas.parentElement.clientWidth : 640;
  const displayH = 140;

  canvas.width = Math.round(displayW * dpr);
  canvas.height = Math.round(displayH * dpr);
  canvas.style.width  = displayW + "px";
  canvas.style.height = displayH + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayW, displayH);

  const W = displayW;
  const H = displayH;

  // ── Staff geometry ──
  const staffTop = Math.round(H / 2 - LS);
  const sMid     = staffTop + 2 * LS;
  const sBot     = staffTop + 4 * LS;

  // ── Header widths ──
  const MARGIN    = 10;
  const CLEF_W    = 24;
  const TIMESIG_W = 28;
  const contentX  = MARGIN + CLEF_W + TIMESIG_W + 6;

  // ── Draw 5 staff lines ──
  ctx.save();
  ctx.strokeStyle = STAFF_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = staffTop + i * LS + 0.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y);
    ctx.lineTo(W - MARGIN, y);
    ctx.stroke();
  }

  // ── Opening bar line ──
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN, staffTop);
  ctx.lineTo(MARGIN, sBot);
  ctx.stroke();

  // ── Percussion clef (two thick vertical bars) ──
  ctx.strokeStyle = CLEF_COLOR;
  ctx.lineWidth = 3;
  const cx = MARGIN + 10;
  ctx.beginPath(); ctx.moveTo(cx,     staffTop - 2); ctx.lineTo(cx,     sBot + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 6, staffTop - 2); ctx.lineTo(cx + 6, sBot + 2); ctx.stroke();

  // ── Time signature ──
  ctx.fillStyle = CLEF_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tsX = MARGIN + CLEF_W + 14;
  ctx.font = `bold ${Math.round(LS * 2)}px Georgia, serif`;
  ctx.fillText(String(timeSig.beats), tsX, staffTop + LS * 0.9);
  ctx.fillText(String(timeSig.value), tsX, staffTop + LS * 2.9);

  ctx.restore();

  // ── Layout notes ──
  const totalDur  = pattern.reduce((s, e) => s + e.duration, 0);
  const availW    = W - contentX - MARGIN;
  const minPxPerBeat = 40;
  const pxPerBeat = Math.max(availW / totalDur, minPxPerBeat);

  let beatCursor = 0;
  const positioned = pattern.map((event) => {
    const xCenter = contentX + beatCursor * pxPerBeat + (event.duration * pxPerBeat) / 2;
    const obj = { event, xCenter, beatStart: beatCursor };
    beatCursor += event.duration;
    return obj;
  });

  // ── Measure bar lines ──
  ctx.save();
  ctx.strokeStyle = STAFF_COLOR;
  ctx.lineWidth = 1;
  positioned.forEach((pos) => {
    const endBeat = pos.beatStart + pos.event.duration;
    const onBoundary = Math.abs(endBeat % timeSig.beats) < 0.001;
    if (onBoundary && endBeat > 0 && endBeat < totalDur - 0.001) {
      const barX = contentX + endBeat * pxPerBeat;
      ctx.beginPath();
      ctx.moveTo(barX, staffTop);
      ctx.lineTo(barX, sBot);
      ctx.stroke();
    }
  });
  ctx.restore();

  // ── Find beam groups ──
  const beamGroups = findBeamGroups(positioned, timeSig);
  const beamedSet = new Set(beamGroups.flatMap((g) => g.map((p) => p.xCenter)));

  // ── Draw beams and stems ──
  ctx.save();
  ctx.fillStyle   = NOTE_COLOR;
  ctx.strokeStyle = NOTE_COLOR;
  ctx.lineWidth   = 1.5;

  beamGroups.forEach((group) => {
    const stemTipY = sMid - STEM_H;
    const x0 = group[0].xCenter + NRX;
    const xN = group[group.length - 1].xCenter + NRX;

    // Primary beam
    ctx.fillRect(x0, stemTipY, xN - x0 + 1, BEAM_W);

    // Secondary beam for sixteenth-or-shorter notes in the group.
    // Also draws a stub beam connecting a dotted-eighth to its paired sixteenth.
    const hasSixteenth = group.some((p) => p.event.duration <= 0.25);
    if (hasSixteenth) {
      for (let i = 0; i < group.length; i++) {
        const dur = group[i].event.duration;
        // Skip eighth-value and longer (plain eighth, dotted eighth) — primary beam only
        if (dur >= 0.5) continue;
        const sx = group[i].xCenter + NRX;
        const nextNeedsSecondary = i < group.length - 1 && group[i + 1].event.duration < 0.5;
        const prevConnectedHere  = i > 0             && group[i - 1].event.duration < 0.5;

        if (nextNeedsSecondary) {
          // Full segment to adjacent secondary-beam note
          const nx = group[i + 1].xCenter + NRX;
          ctx.fillRect(sx, stemTipY + BEAM_W + BEAM_GAP, nx - sx + 1, BEAM_W);
        } else if (!prevConnectedHere) {
          // Isolated or leading secondary-beam note — stub direction depends on position
          if (i === 0) {
            ctx.fillRect(sx,      stemTipY + BEAM_W + BEAM_GAP, 11, BEAM_W); // stub right
          } else {
            ctx.fillRect(sx - 10, stemTipY + BEAM_W + BEAM_GAP, 11, BEAM_W); // stub left
          }
        }
        // else: previous iteration already drew a segment ending at this stem — nothing to add
      }
    }

    // Stems
    group.forEach((pos) => {
      const sx = pos.xCenter + NRX;
      ctx.beginPath();
      ctx.moveTo(sx, sMid);
      ctx.lineTo(sx, stemTipY);
      ctx.stroke();
    });
  });

  ctx.restore();

  // ── Draw individual notes and rests ──
  positioned.forEach((pos) => {
    if (pos.event.type === "note") {
      drawNote(ctx, pos.xCenter, sMid, pos.event.duration, beamedSet.has(pos.xCenter), staffTop);
    } else {
      drawRest(ctx, pos.xCenter, sMid, pos.event.duration, staffTop);
    }
  });

  // ── Double bar line at end ──
  const endX = contentX + totalDur * pxPerBeat;
  ctx.save();
  ctx.strokeStyle = STAFF_COLOR;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(endX, staffTop); ctx.lineTo(endX, sBot); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(endX + 5, staffTop); ctx.lineTo(endX + 5, sBot); ctx.stroke();
  ctx.restore();
}

// ── Beam group finder ──────────────────────────────────────────────────────────────

function findBeamGroups(positioned, timeSig) {
  const groups = [];
  let currentGroup = [];
  let currentBeat  = -1;

  positioned.forEach((pos) => {
    const beatIdx = Math.floor(pos.beatStart);
    if (isBeamable(pos.event.duration) && pos.event.type === "note") {
      if (beatIdx === currentBeat || currentGroup.length === 0) {
        currentGroup.push(pos);
        currentBeat = beatIdx;
      } else {
        if (currentGroup.length >= 2) groups.push([...currentGroup]);
        currentGroup = [pos];
        currentBeat  = beatIdx;
      }
    } else {
      if (currentGroup.length >= 2) groups.push([...currentGroup]);
      currentGroup = [];
      currentBeat  = -1;
    }
  });

  if (currentGroup.length >= 2) groups.push(currentGroup);
  return groups;
}

// ── Note drawing ────────────────────────────────────────────────────────────────

function drawNote(ctx, cx, noteY, duration, isBeamed, staffTop) {
  ctx.save();
  ctx.fillStyle   = NOTE_COLOR;
  ctx.strokeStyle = NOTE_COLOR;

  const dotted  = DOTTED.has(Math.round(duration * 1000) / 1000);
  const baseDur = dotted ? DOTTED.get(Math.round(duration * 1000) / 1000) : duration;

  if (baseDur >= 4) {
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, noteY, NRX + 2, NRY, HEAD_TILT, 0, Math.PI * 2);
    ctx.stroke();
    // Inner cutout to distinguish from half note
    ctx.fillStyle = CANVAS_BG;
    ctx.beginPath();
    ctx.ellipse(cx + 1, noteY, NRX - 1, NRY - 1.5, HEAD_TILT, 0, Math.PI * 2);
    ctx.fill();
  } else if (baseDur >= 2) {
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(cx, noteY, NRX, NRY, HEAD_TILT, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + NRX - 1, noteY);
    ctx.lineTo(cx + NRX - 1, noteY - STEM_H);
    ctx.stroke();
  } else {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, noteY, NRX, NRY, HEAD_TILT, 0, Math.PI * 2);
    ctx.fill();

    if (!isBeamed) {
      ctx.lineWidth = 1.5;
      const sx = cx + NRX - 1;
      ctx.beginPath();
      ctx.moveTo(sx, noteY);
      ctx.lineTo(sx, noteY - STEM_H);
      ctx.stroke();
      if (baseDur <= 0.5) {
        drawFlag(ctx, sx, noteY - STEM_H, baseDur);
      }
    }
  }

  if (dotted) {
    ctx.fillStyle = NOTE_COLOR;
    ctx.beginPath();
    ctx.arc(cx + NRX + 5, noteY - LS * 0.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawFlag(ctx, stemTipX, stemTipY, baseDur) {
  ctx.strokeStyle = NOTE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(stemTipX, stemTipY);
  ctx.bezierCurveTo(
    stemTipX + 14, stemTipY + 4,
    stemTipX + 10, stemTipY + 14,
    stemTipX + 3,  stemTipY + 20
  );
  ctx.stroke();

  if (baseDur <= 0.25) {
    ctx.beginPath();
    ctx.moveTo(stemTipX, stemTipY + 8);
    ctx.bezierCurveTo(
      stemTipX + 14, stemTipY + 12,
      stemTipX + 10, stemTipY + 22,
      stemTipX + 3,  stemTipY + 28
    );
    ctx.stroke();
  }
}

// ── Rest drawing ────────────────────────────────────────────────────────────────

function drawRest(ctx, cx, sMid, duration, staffTop) {
  ctx.save();
  ctx.fillStyle   = NOTE_COLOR;
  ctx.strokeStyle = NOTE_COLOR;

  const dotted  = DOTTED.has(Math.round(duration * 1000) / 1000);
  const baseDur = dotted ? DOTTED.get(Math.round(duration * 1000) / 1000) : duration;

  if (baseDur >= 4) {
    // Whole rest: filled rectangle hanging from 2nd line
    ctx.fillRect(cx - 7, staffTop + LS - 1, 14, 6);
  } else if (baseDur >= 2) {
    ctx.fillRect(cx - 7, sMid - 6, 14, 6);
  } else if (_bravuraLoaded) {
    // Quarter / eighth / sixteenth: use Bravura SMuFL glyph
    const glyph = baseDur >= 1 ? GLYPH_REST_QUARTER
                : baseDur >= 0.5 ? GLYPH_REST_EIGHTH
                : GLYPH_REST_SIXTEENTH;
    ctx.font         = `normal ${BRAVURA_SIZE}px Bravura`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    // Compute visual center of the glyph and position it at sMid
    const m     = ctx.measureText(glyph);
    const drawY = sMid + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    ctx.fillText(glyph, cx, drawY);
  } else {
    // Bravura not loaded yet — bezier fallback
    if (baseDur >= 1) drawQuarterRest(ctx, cx, sMid);
    else if (baseDur >= 0.5) drawEighthRest(ctx, cx, sMid);
    else drawSixteenthRest(ctx, cx, sMid);
  }

  if (dotted) {
    ctx.fillStyle = NOTE_COLOR;
    ctx.beginPath();
    ctx.arc(cx + 12, sMid - LS * 0.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawQuarterRest(ctx, cx, cy) {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const top = cy - LS * 1.4;
  const bot = cy + LS * 1.1;

  // Short flag angling upper-right
  ctx.beginPath();
  ctx.moveTo(cx - 4, top);
  ctx.lineTo(cx + 6, top + LS * 0.55);
  ctx.stroke();

  // Diagonal slash down-left
  ctx.beginPath();
  ctx.moveTo(cx + 4, top + LS * 0.45);
  ctx.lineTo(cx - 4, top + LS * 1.15);
  ctx.stroke();

  // Hook sweeping right then down into terminal dot
  ctx.beginPath();
  ctx.moveTo(cx - 3, top + LS * 1.05);
  ctx.bezierCurveTo(
    cx + 9, top + LS * 1.1,
    cx + 8, top + LS * 1.85,
    cx,     bot
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, bot, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEighthRest(ctx, cx, cy) {
  // Eighth rest: filled blob at upper-right + diagonal stem to lower-left
  const dotX = cx + 4;
  const dotY = cy - LS * 0.8;

  ctx.beginPath();
  ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(dotX, dotY + 3);
  ctx.lineTo(cx - 3, cy + LS * 0.75);
  ctx.stroke();
}

function drawSixteenthRest(ctx, cx, cy) {
  // Sixteenth rest: two blobs + longer diagonal stem
  const dot1X = cx + 4;
  const dot1Y = cy - LS * 1.6;
  const dot2X = cx + 4;
  const dot2Y = cy - LS * 0.55;

  ctx.beginPath();
  ctx.arc(dot1X, dot1Y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dot2X, dot2Y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(dot1X, dot1Y + 3);
  ctx.lineTo(cx - 3, cy + LS * 0.75);
  ctx.stroke();
}
