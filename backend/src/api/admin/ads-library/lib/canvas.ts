// @ts-nocheck
/**
 * Canvas prep for outpainting a square source ad into Meta's 4:5 feed ratio.
 *
 * Why this exists: handing Gemini a 1:1 reference and asking for a 4:5 output
 * makes it REDRAW the whole scene to fit the taller frame — people get stretched
 * and faces drift. Instead we pre-build the 4:5 canvas ourselves with the
 * original pixels centred and empty bands top and bottom, ask the model to paint
 * ONLY those bands, and then paste the original back over the centre so it is
 * bit-for-bit untouched.
 *
 *      ┌──────────────┐  ← band to generate
 *      ├──────────────┤
 *      │   original   │  ← untouched (80 % of height)
 *      ├──────────────┤
 *      └──────────────┘  ← band to generate
 *
 * Two seeds for the bands were tried and both were worse — do not reintroduce:
 *   - mirrored edge strips: whatever the model doesn't fully repaint reads as an
 *     obvious flipped copy of the scene.
 *   - blurred edge smear: measured centre deviation of 42.9/255 — the model read
 *     the soft canvas as "this is a rough sketch" and re-generated the WHOLE
 *     photograph, different composition and all. Flat grey measured 2.5/255.
 */

const sharp = require("sharp")

/** How many rows at the source's edge are inspected to judge "is this flat?". */
const EDGE_SAMPLE = 24
/**
 * Max per-channel spread within a column's edge sample to call it flat (0-255).
 * Calibrated on real creatives, not guessed: JPEG noise alone puts the median
 * spread around 8, so a tolerance of 6 found almost nothing (3 % of columns on a
 * flat-background illustration). 12 gives 79 %/70 % there while still leaving a
 * textured photo at 23 %/10 % — i.e. aggressive on graphics, hands-off on photos.
 */
const FLAT_TOLERANCE = 12
/** Flat runs shorter than this are ignored, so speckle doesn't create stripes. */
const MIN_FLAT_RUN = 16
/**
 * A band is filled with edge colours ONLY when nearly the whole width is flat.
 * Mixing filled columns with grey ones in the same band was a mistake: on
 * photos with dark vertical structure at the edge (door frames, shelving) it
 * produced literal barcode stripes, and the model left the grey slivers alone.
 * All-or-nothing — either the band is a solid colour continuation, or it is
 * plain grey and the model paints the whole thing.
 */
const FLAT_BAND_MIN = 0.92
/** Alpha ramp (px) where the pasted original meets a generated band. */
const SEAM_FEATHER = 8

export type Composed = {
  buffer: Buffer
  mime: string
  /** canvas dimensions — the source width, and the 4:5 height */
  width: number
  height: number
  padTop: number
  padBottom: number
  /** true when the source was already 4:5 (or taller) and no bands were added */
  skipped: boolean
  /** false when both bands were filled deterministically — no model call needed */
  needsModel: boolean
  /** how much of each band was solved without the model, for the job log */
  solidPctTop: number
  solidPctBottom: number
}

/**
 * Per-column verdict on whether the source's edge is a flat colour there, plus
 * that colour. A column counts as flat when all sampled rows sit within
 * FLAT_TOLERANCE of each other on every channel — i.e. a solid background, or a
 * horizontal gradient (which varies across x, not down y). A vertical gradient
 * or any texture is not flat and goes to the model.
 */
function scanEdge(raw: Buffer, w: number, h: number, ch: number, fromTop: boolean) {
  const flat = new Array<boolean>(w)
  const colour = new Uint8Array(w * 3)
  for (let x = 0; x < w; x++) {
    let ok = true
    for (let c = 0; c < 3; c++) {
      let min = 255, max = 0, sum = 0
      for (let s = 0; s < EDGE_SAMPLE; s++) {
        const y = fromTop ? s : h - 1 - s
        const v = raw[(y * w + x) * ch + c]
        if (v < min) min = v
        if (v > max) max = v
        sum += v
      }
      if (max - min > FLAT_TOLERANCE) ok = false
      colour[x * 3 + c] = Math.round(sum / EDGE_SAMPLE)
    }
    flat[x] = ok
  }
  // Collapse into runs so speckle can be cleaned up in both directions.
  const runs: Array<{ from: number; to: number; flat: boolean }> = []
  for (let x = 0; x < w; x++) {
    const last = runs[runs.length - 1]
    if (last && last.flat === flat[x]) last.to = x
    else runs.push({ from: x, to: x, flat: flat[x] })
  }

  // 1) Drop flat runs too short to be a real background region — a handful of
  //    accidentally-flat columns inside a textured area would otherwise extend
  //    as thin coloured stripes into the band.
  for (const r of runs) {
    if (r.flat && r.to - r.from + 1 < MIN_FLAT_RUN) {
      r.flat = false
      for (let i = r.from; i <= r.to; i++) flat[i] = false
    }
  }

  // 2) Close short NON-flat gaps that sit between two flat runs. Without this a
  //    3 px blip in an otherwise solid background stays grey, the model repaints
  //    just that sliver slightly off-colour, and the band ends up with a thin
  //    vertical line through it. The gap's colour is interpolated across it.
  for (let i = 1; i < runs.length - 1; i++) {
    const r = runs[i]
    if (r.flat || r.to - r.from + 1 >= MIN_FLAT_RUN) continue
    if (!runs[i - 1].flat || !runs[i + 1].flat) continue
    const left = r.from - 1, right = r.to + 1
    for (let x = r.from; x <= r.to; x++) {
      const t = (x - left) / (right - left)
      for (let c = 0; c < 3; c++) {
        colour[x * 3 + c] = Math.round(colour[left * 3 + c] * (1 - t) + colour[right * 3 + c] * t)
      }
      flat[x] = true
    }
    r.flat = true
  }

  return { flat, colour }
}

/**
 * Build one band. Either the whole thing is a colour continuation of the edge
 * (only when FLAT_BAND_MIN of the width is genuinely flat — the few non-flat
 * columns are then interpolated from their flat neighbours so no grey and no
 * stripe survives), or the whole thing is plain grey for the model to paint.
 */
function buildBand(w: number, bandH: number, scan: { flat: boolean[]; colour: Uint8Array }) {
  const flatCount = scan.flat.reduce((n, f) => n + (f ? 1 : 0), 0)
  const ratio = w ? flatCount / w : 1
  if (ratio < FLAT_BAND_MIN) {
    return { band: Buffer.alloc(w * bandH * 3, 128), solidPct: 0 }
  }

  // Fill every column: flat ones with their own colour, the rest carried over
  // from the nearest flat column on each side so the row stays continuous.
  const col = new Uint8Array(w * 3)
  let lastFlat = -1
  for (let x = 0; x < w; x++) {
    if (scan.flat[x]) {
      for (let c = 0; c < 3; c++) col[x * 3 + c] = scan.colour[x * 3 + c]
      lastFlat = x
      continue
    }
    let nextFlat = -1
    for (let k = x + 1; k < w; k++) if (scan.flat[k]) { nextFlat = k; break }
    for (let c = 0; c < 3; c++) {
      const a = lastFlat >= 0 ? scan.colour[lastFlat * 3 + c] : (nextFlat >= 0 ? scan.colour[nextFlat * 3 + c] : 128)
      const bv = nextFlat >= 0 ? scan.colour[nextFlat * 3 + c] : a
      const t = lastFlat >= 0 && nextFlat >= 0 ? (x - lastFlat) / (nextFlat - lastFlat) : 0
      col[x * 3 + c] = Math.round(a * (1 - t) + bv * t)
    }
  }

  const band = Buffer.alloc(w * bandH * 3)
  for (let y = 0; y < bandH; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      band[i] = col[x * 3]; band[i + 1] = col[x * 3 + 1]; band[i + 2] = col[x * 3 + 2]
    }
  }
  return { band, solidPct: 100 }
}

/**
 * Place `srcBuffer` centred on a 4:5 canvas, padding equally top and bottom.
 *
 * The bands are a hybrid: columns whose source edge is a flat colour are
 * extended with exactly that colour (deterministic — a solid extended into
 * itself is neither a smear nor a mirror), everything else is mid-grey for the
 * model to paint. Grey is unmistakably "empty area to fill", which is what stops
 * the model regenerating the centre.
 */
export async function composeFeedCanvas(srcBuffer: Buffer): Promise<Composed> {
  const meta = await sharp(srcBuffer).metadata()
  const w = meta.width || 0
  const h = meta.height || 0
  if (!w || !h) throw new Error("nelze přečíst rozměry zdrojového obrázku")

  const targetH = Math.round((w * 5) / 4)
  // Skip when the source is already 4:5 (or taller). The 2 % tolerance matters:
  // a 1856×2304 image is 4:5 for all practical purposes, and padding it by 8 px
  // would spend a generation on bands nobody can see.
  if (h >= targetH * 0.98) {
    return {
      buffer: srcBuffer, mime: meta.format === "png" ? "image/png" : "image/jpeg",
      width: w, height: h, padTop: 0, padBottom: 0,
      skipped: true, needsModel: false, solidPctTop: 100, solidPctBottom: 100,
    }
  }

  const pad = targetH - h
  const padTop = Math.floor(pad / 2)
  const padBottom = pad - padTop

  const { data: raw, info } = await sharp(srcBuffer).raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  const top = buildBand(w, padTop, scanEdge(raw, w, h, ch, true))
  const bottom = buildBand(w, padBottom, scanEdge(raw, w, h, ch, false))

  const buffer = await sharp({ create: { width: w, height: targetH, channels: 3, background: { r: 128, g: 128, b: 128 } } })
    .composite([
      { input: top.band, raw: { width: w, height: padTop, channels: 3 }, top: 0, left: 0 },
      { input: srcBuffer, top: padTop, left: 0 },
      { input: bottom.band, raw: { width: w, height: padBottom, channels: 3 }, top: padTop + h, left: 0 },
    ])
    .png()
    .toBuffer()

  return {
    buffer, mime: "image/png", width: w, height: targetH, padTop, padBottom,
    skipped: false,
    needsModel: top.solidPct < 100 || bottom.solidPct < 100,
    solidPctTop: top.solidPct, solidPctBottom: bottom.solidPct,
  }
}

/** Canvases are built as PNG; ads ship as JPEG. Saves the caller importing sharp. */
export async function toJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).jpeg({ quality: 92 }).toBuffer()
}

/**
 * Take the model's 4:5 output, keep only its two bands, and put the original
 * back in the middle.
 *
 * The model re-renders the whole canvas even when told not to (measured drift
 * ~2.5/255 on a photo, but visibly more on flat illustrations with hard lines),
 * so the centre it returns is never quite the approved image. Pasting the real
 * pixels back makes "the 1:1 is untouched" a guarantee rather than a hope.
 *
 * SEAM_FEATHER px of alpha ramp at each seam absorbs sub-pixel drift between the
 * model's centre and ours. That is a crossfade between two near-identical
 * images, not a blur — nothing gets softened.
 */
export async function pasteOriginalCentre(modelOutput: Buffer, srcBuffer: Buffer, c: Composed): Promise<Buffer> {
  const srcMeta = await sharp(srcBuffer).metadata()
  const w = srcMeta.width || c.width
  const h = srcMeta.height || 0

  // The model returns its own resolution (e.g. 1856×2304 for a 2048×2560
  // canvas). Normalise to the canvas grid so the centre lands where we put it.
  const base = await sharp(modelOutput).resize(c.width, c.height, { fit: "fill" }).toBuffer()

  const feather = Math.min(SEAM_FEATHER, Math.floor(h / 4))
  let overlay = srcBuffer
  if (feather > 0) {
    const alpha = Buffer.alloc(w * h, 255)
    for (let y = 0; y < feather; y++) {
      const v = Math.round(((y + 1) / (feather + 1)) * 255)
      alpha.fill(v, y * w, (y + 1) * w)
      alpha.fill(v, (h - 1 - y) * w, (h - y) * w)
    }
    overlay = await sharp(srcBuffer)
      .ensureAlpha()
      .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
      .png()
      .toBuffer()
  }

  return sharp(base)
    .composite([{ input: overlay, top: c.padTop, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

/**
 * Instruction appended to the image prompt so the model treats the canvas as an
 * extension job, not a redraw. Percentages (not pixels) because the model
 * reasons about the frame proportionally.
 */
export function outpaintInstruction(padTop: number, padBottom: number, height: number): string {
  const centrePct = 100 - Math.round((padTop / height) * 100) - Math.round((padBottom / height) * 100)
  return `Extend this image vertically: fill in the empty band across the top and the empty band across the bottom.

Keep the central ~${centrePct}% exactly as it is in the input — identical composition, framing, subjects, proportions, colours and lettering.

Fill the empty grey areas with more of the background that already touches those borders: the same surfaces, the same colours, the same perspective carrying on. Where part of a band is already a solid colour, that colour is correct — carry it unchanged to the edge of the frame. Match the input's medium, lighting, colour grade, sharpness and grain exactly, so the new areas are indistinguishable from the original: the same photographic look or the same illustration style, the same outline weight, the same texture.

The bands are background only; every subject stays in the centre. Do not repeat, mirror or duplicate anything. Leave no grey and no visible seam.`
}
