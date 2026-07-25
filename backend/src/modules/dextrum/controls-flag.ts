// Feature flag for the Dextrum admin control tools (cancel / edit / live status /
// tracking). Built but INACTIVE by default — every control route calls
// `guardControlsEnabled(res)` first and short-circuits with a 503 until the flag
// is explicitly turned on.
//
// To activate later: set env  DEXTRUM_CONTROLS_ENABLED=true  on the backend.
// Nothing reaches the Dextrum/mySTOCK API while the flag is off.

export function dextrumControlsEnabled(): boolean {
  return String(process.env.DEXTRUM_CONTROLS_ENABLED || "").toLowerCase() === "true"
}

/**
 * Returns true when the controls are enabled. When disabled it writes a 503 to
 * `res` and returns false, so a route can do:
 *
 *   if (!guardControlsEnabled(res)) return
 */
export function guardControlsEnabled(res: any): boolean {
  if (dextrumControlsEnabled()) return true
  res.status(503).json({
    error: "Dextrum ovládací nástroje jsou zatím neaktivní.",
    message: "Dextrum ovládací nástroje jsou zatím neaktivní.",
    disabled: true,
  })
  return false
}
