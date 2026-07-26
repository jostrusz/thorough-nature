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
 * The bands are filled with flat mid-grey — nothing else. See the note in
 * composeFeedCanvas for why every "smarter" seed we tried made things worse.
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

  // Flat mid-grey bands — nothing clever. Two "smarter" seeds were tried and
  // both were worse, so don't reintroduce them:
  //   - mirrored edge strips: whatever the model doesn't fully repaint reads as
  //     an obvious flipped copy of the scene.
  //   - blurred edge smear: measured centre deviation of 42.9/255 — the model
  //     read the soft canvas as "this is a rough sketch" and re-generated the
  //     WHOLE photograph, different composition and all.
  // Flat grey measured 2.5/255 (i.e. the centre survives) with an invisible
  // seam, because grey is unmistakably "empty area to fill", not content.
  const buffer = await sharp(srcBuffer)
    .extend({ top: padTop, bottom: padBottom, left: 0, right: 0, background: { r: 128, g: 128, b: 128 } })
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

CANVAS EXTENSION — FILL IN ONLY THE TWO FLAT GREY BANDS:
The central ~${100 - topPct - bottomPct}% is a finished image. Reproduce it pixel-for-pixel: same composition, same framing, same people, same objects, same crop, same proportions, same colours. Do NOT re-shoot, re-render, re-frame, zoom, re-pose or restyle it in any way. If anything in the centre changes, the edit is wrong.

The flat grey band across the TOP ~${topPct}% and the flat grey band across the BOTTOM ~${bottomPct}% are empty placeholders. Paint them as a seamless continuation of the same image: extend the walls, sky, floor, furniture, fabric, surfaces and shadows that already run into those borders, following their existing perspective lines and vanishing point.

MATCH THE ORIGINAL'S STYLE EXACTLY in the bands:
- Medium: if the centre is a photograph, the bands are the same photograph — same camera, same lens, same depth of field. If it is an illustration/3D render/painting, match that rendering style, line weight and shading.
- Focus: fully sharp where the adjacent centre is sharp, out of focus only where the adjacent centre is already out of focus. Never add blur, softness or a smeared transition of your own.
- Light: same direction, same colour temperature, same softness and contrast of shadows.
- Colour: same grade, saturation and white balance — no brighter, cleaner or more saturated than the centre.
- Texture: same film grain / noise / sharpness. Freshly generated areas usually come out too clean — deliberately match the centre's grain so the bands do not look smoother than the original.
- Vignetting and any colour cast must continue consistently to the new edges.

Add NOTHING new: no extra people, products, objects, logos or text in the bands — only more of what is already there. Do not mirror, flip or duplicate any part of the image. No grey may remain anywhere. The seam where each band meets the centre must be completely invisible: no line, no brightness step, no change in sharpness or grain.`
}
