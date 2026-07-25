import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { dextrumControlsEnabled } from "../../../../modules/dextrum/controls-flag"

// GET /admin/dextrum/controls-status
// Tells the admin UI whether the Dextrum control tools are active. While the
// flag is off the UI renders the buttons disabled. Flip DEXTRUM_CONTROLS_ENABLED
// to activate everything at once.
export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ enabled: dextrumControlsEnabled() })
}
