// @ts-nocheck
/**
 * Canvas prep for outpainting a square source ad into Meta's 4:5 feed ratio.
 *
 * Why this exists: handing Gemini a 1:1 reference and asking for a 4:5 output
 * makes it REDRAW the whole scene to fit the taller frame — people get stretched
 * and faces drift. Instead we pre-build the 4:5 canvas ourselves with the
 * original pixels centred and empty bands top and bottom, then ask the model to
 * paint ONLY those bands. The original composition stays exactly as it was.
 *
 *      ┌──────────────┐  ← band to generate
 *      ├──────────────┤
 *      │   original   │  ← untouched (80 % of height)
 *      ├──────────────┤
 *      └──────────────┘  ← band to generate
 */

const sharp = require("sharp")

export type Composed = {
  buffer: Buffer
  mime: string
  width: number
  height: number
  padTop: number
  padBottom: number
  /** true when the source was already 4:5 (or taller) and no bands were added */
  skipped: boolean
}

/**
 * Place `srcBuffer` centred on a 4:5 canvas, padding equally top and bottom.
 * The bands are filled with a blurred, mirrored continuation of the adjacent
 * edge rather than flat white — a plain white block tempts the model to leave
 * it white or paint a hard seam, while a soft continuation gives it colour and
 * lighting to blend into.
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
    return { buffer: srcBuffer, mime: meta.format === "png" ? "image/png" : "image/jpeg", width: w, height: h, padTop: 0, padBottom: 0, skipped: true }
  }

  const pad = targetH - h
  const padTop = Math.floor(pad / 2)
  const padBottom = pad - padTop

  // Backdrop: the source blown up to fill the taller canvas and heavily blurred.
  // It only ever shows through in the bands, so the visible result is a soft
  // colour continuation of the scene — a hint for the model, not final content.
  const backdrop = await sharp(srcBuffer)
    .resize(w, targetH, { fit: "cover", position: "center" })
    .blur(40)
    .toBuffer()

  const buffer = await sharp(backdrop)
    .composite([{ input: srcBuffer, top: padTop, left: 0 }])
    .png()
    .toBuffer()

  return { buffer, mime: "image/png", width: w, height: targetH, padTop, padBottom, skipped: false }
}

/**
 * Instruction appended to the image prompt so the model treats the canvas as an
 * extension job, not a redraw. Percentages (not pixels) because the model
 * reasons about the frame proportionally.
 */
export function outpaintInstruction(padTop: number, padBottom: number, height: number): string {
  const topPct = Math.round((padTop / height) * 100)
  const bottomPct = Math.round((padBottom / height) * 100)
  return `

CANVAS EXTENSION — READ CAREFULLY:
This image is a 4:5 canvas. The central ~${100 - topPct - bottomPct}% is the ORIGINAL advertisement and must be preserved EXACTLY: same composition, same framing, same people, same proportions, same faces. Do NOT stretch, zoom, re-crop, re-pose or re-render the central area.
Only the blurred band across the TOP ~${topPct}% and the blurred band across the BOTTOM ~${bottomPct}% are placeholders. Paint those two bands so they continue the scene naturally — extend the background, walls, sky, floor, furniture and lighting that are already there. No new people, no new products, no text in the bands.
The seam between the bands and the central area must be invisible.`
}
