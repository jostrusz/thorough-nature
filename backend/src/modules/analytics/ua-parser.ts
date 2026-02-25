export interface ParsedUA {
  device_type: "desktop" | "mobile" | "tablet"
  browser: string
  os: string
}

export function parseUserAgent(ua: string): ParsedUA {
  const lower = ua.toLowerCase()

  // Device type
  let device_type: "desktop" | "mobile" | "tablet" = "desktop"
  if (/tablet|ipad|playbook|silk/.test(lower)) {
    device_type = "tablet"
  } else if (/mobi|android|iphone|ipod|opera mini|iemobile/.test(lower)) {
    device_type = "mobile"
  }

  // Browser
  let browser = "Other"
  if (/edg/.test(lower)) browser = "Edge"
  else if (/opr|opera/.test(lower)) browser = "Opera"
  else if (/chrome|crios/.test(lower) && !/edg/.test(lower)) browser = "Chrome"
  else if (/firefox|fxios/.test(lower)) browser = "Firefox"
  else if (/safari/.test(lower) && !/chrome/.test(lower)) browser = "Safari"

  // OS
  let os = "Other"
  if (/windows/.test(lower)) os = "Windows"
  else if (/macintosh|mac os/.test(lower)) os = "macOS"
  else if (/iphone|ipad|ipod/.test(lower)) os = "iOS"
  else if (/android/.test(lower)) os = "Android"
  else if (/linux/.test(lower)) os = "Linux"

  return { device_type, browser, os }
}
