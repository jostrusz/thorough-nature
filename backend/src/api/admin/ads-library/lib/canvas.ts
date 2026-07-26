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

  // Band seeds: mirror the strip of pixels next to each edge and blur it lightly.
  // A mirrored strip carries STRUCTURE across the seam — a wall keeps going up,
  // a horizon stays level, a floor keeps receding — so the model extends the
  // real scene instead of inventing one. Pure blur (the first attempt) only gave
  // it colour, which is why bands could drift in style. The light blur on top
  // stops the mirror from reading as a hard reflection.
  const seedTop = await sharp(srcBuffer)
    .extract({ left: 0, top: 0, width: w, height: Math.min(padTop * 2, h) })
    .flip()                       // vertical mirror
    .resize(w, padTop, { fit: "fill" })
    .blur(12)
    .toBuffer()
  const seedBottom = await sharp(srcBuffer)
    .extract({ left: 0, top: Math.max(0, h - Math.min(padBottom * 2, h)), width: w, height: Math.min(padBottom * 2, h) })
    .flip()
    .resize(w, padBottom, { fit: "fill" })
    .blur(12)
    .toBuffer()

  const buffer = await sharp({
    create: { width: w, height: targetH, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: seedTop, top: 0, left: 0 },
      { input: srcBuffer, top: padTop, left: 0 },
      { input: seedBottom, top: padTop + h, left: 0 },
    ])
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
Only the soft band across the TOP ~${topPct}% and the soft band across the BOTTOM ~${bottomPct}% are placeholders. Repaint those two bands as a natural continuation of the scene: carry on the walls, sky, floor, furniture, fabric and shadows that are already running into that edge, following their existing perspective lines and vanishing point.

MATCH THE ORIGINAL'S STYLE EXACTLY in the bands:
- Medium: if the centre is a photograph, the bands are the same photograph — same lens, same depth of field, same focus falloff. If it is an illustration/3D render/painting, match that rendering style, line weight and shading.
- Light: same direction, same colour temperature, same softness and contrast of shadows.
- Colour: same grade, saturation and white balance — no brighter, cleaner or more saturated than the centre.
- Texture: same film grain / noise / sharpness. Freshly generated areas usually come out too clean — deliberately match the centre's grain so the bands do not look smoother than the original.
- Vignetting and any colour cast must continue consistently to the new edges.

Add NOTHING new: no extra people, products, objects, logos or text in the bands — only more of what is already there. The seam where each band meets the centre must be completely invisible: no line, no brightness step, no change in sharpness or grain.`
}
