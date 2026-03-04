import { Metadata } from "next"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export const metadata: Metadata = {
  title: "Download je e-books",
  description: "Download je digitale exemplaren",
}

interface DownloadFile {
  title: string
  description: string
  size: string
  download_url: string
}

interface DownloadData {
  download: {
    order_id: string
    email: string
    expires_at: string
    download_count: number
    project_id?: string
    files: DownloadFile[]
  }
}

// ── Project themes ──────────────────────────────────────────────────────

type ProjectTheme = {
  brandLabel: string
  brandName: string
  supportEmail: string
  companyName: string
  companyLocation: string
  page: React.CSSProperties
  container: React.CSSProperties
  header: React.CSSProperties
  brandLabelStyle: React.CSSProperties
  headerTitle: React.CSSProperties
  intro: React.CSSProperties
  fileCard: React.CSSProperties
  fileTitle: React.CSSProperties
  fileMeta: React.CSSProperties
  downloadButton: React.CSSProperties
  expiryNotice: React.CSSProperties
  expiryText: React.CSSProperties
  infoBox: React.CSSProperties
  infoText: React.CSSProperties
  helpBox: React.CSSProperties
  helpText: React.CSSProperties
  helpLink: React.CSSProperties
  footer: React.CSSProperties
  footerBrand: React.CSSProperties
  footerCompany: React.CSSProperties
  errorText: React.CSSProperties
  errorMuted: React.CSSProperties
  errorLink: React.CSSProperties
}

const loslatenboekTheme: ProjectTheme = {
  brandLabel: "LAAT LOS WAT JE KAPOTMAAKT",
  brandName: "Laat Los Wat Je Kapotmaakt",
  supportEmail: "devries@loslatenboek.nl",
  companyName: "EverChapter OÜ",
  companyLocation: "Tallinn, Estonia",
  page: {
    minHeight: "100vh",
    backgroundColor: "#FAF5F8",
    fontFamily: "'Inter', Arial, Helvetica, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
  },
  container: {
    maxWidth: "520px",
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 2px 16px rgba(45, 27, 61, 0.08)",
  },
  header: {
    background: "linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)",
    padding: "36px 40px",
    textAlign: "center" as const,
  },
  brandLabelStyle: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "#C27BA0",
    margin: "0 0 10px 0",
  },
  headerTitle: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "22px",
    fontWeight: 700,
    color: "#ffffff",
    margin: "0",
    lineHeight: "1.3",
  },
  intro: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "15px",
    color: "#5A3D6B",
    lineHeight: "1.6",
    margin: "0 0 28px 0",
  },
  fileCard: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#FAF5F8",
    borderRadius: "10px",
    border: "1px solid #EDD9E5",
    padding: "20px",
    marginBottom: "16px",
    gap: "16px",
  },
  fileTitle: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "15px",
    fontWeight: 600,
    color: "#2D1B3D",
    margin: "0 0 4px 0",
    lineHeight: "1.3",
  },
  fileMeta: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "12px",
    color: "#9B7AAD",
    margin: "0",
  },
  downloadButton: {
    display: "inline-block",
    backgroundColor: "#C27BA0",
    color: "#ffffff",
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
  },
  expiryNotice: {
    backgroundColor: "#FFF8E1",
    borderRadius: "8px",
    padding: "12px 16px",
    textAlign: "center" as const,
    border: "1px solid #FFE082",
    marginBottom: "20px",
    marginTop: "8px",
  },
  expiryText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "13px",
    color: "#795548",
    margin: "0",
  },
  infoBox: {
    backgroundColor: "#FAF5F8",
    borderRadius: "10px",
    border: "1px solid #EDD9E5",
    padding: "16px 20px",
    textAlign: "center" as const,
    marginBottom: "20px",
  },
  infoText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    color: "#5A3D6B",
    lineHeight: "1.6",
    margin: "0",
  },
  helpBox: {
    textAlign: "center" as const,
    paddingTop: "16px",
    borderTop: "1px solid #EDD9E5",
  },
  helpText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "13px",
    color: "#9B7AAD",
    margin: "0",
  },
  helpLink: { color: "#C27BA0", textDecoration: "underline" },
  footer: {
    backgroundColor: "#2D1B3D",
    padding: "24px 40px",
    textAlign: "center" as const,
  },
  footerBrand: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "12px",
    color: "#C27BA0",
    margin: "0 0 6px 0",
  },
  footerCompany: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "11px",
    color: "#7a6189",
    margin: "0",
  },
  errorText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "16px",
    color: "#5A3D6B",
    lineHeight: "1.6",
    marginBottom: "24px",
  },
  errorMuted: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    color: "#9B7AAD",
  },
  errorLink: { color: "#C27BA0", textDecoration: "underline" },
}

const dehondenbijbelTheme: ProjectTheme = {
  brandLabel: "DE HONDENBIJBEL",
  brandName: "De Hondenbijbel",
  supportEmail: "support@travelbible.nl",
  companyName: "EverChapter OÜ",
  companyLocation: "Tallinn, Estonia",
  page: {
    minHeight: "100vh",
    backgroundColor: "#FFFBF5",
    fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 16px",
  },
  container: {
    maxWidth: "520px",
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 4px 24px rgba(234, 88, 12, 0.08)",
  },
  header: {
    background: "linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)",
    padding: "40px 40px 36px",
    textAlign: "center" as const,
  },
  brandLabelStyle: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "rgba(255,255,255,0.75)",
    margin: "0 0 10px 0",
  },
  headerTitle: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "24px",
    fontWeight: 800,
    color: "#ffffff",
    margin: "0",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
  },
  intro: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "15px",
    color: "#3F3F46",
    lineHeight: "1.7",
    margin: "0 0 28px 0",
  },
  fileCard: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: "12px",
    border: "1px solid #FED7AA",
    padding: "20px",
    marginBottom: "16px",
    gap: "16px",
  },
  fileTitle: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "15px",
    fontWeight: 700,
    color: "#18181B",
    margin: "0 0 4px 0",
    lineHeight: "1.3",
  },
  fileMeta: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "12px",
    color: "#71717A",
    margin: "0",
  },
  downloadButton: {
    display: "inline-block",
    backgroundColor: "#EA580C",
    color: "#ffffff",
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "10px 20px",
    borderRadius: "10px",
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
  },
  expiryNotice: {
    backgroundColor: "#FFFBEB",
    borderRadius: "12px",
    padding: "12px 16px",
    textAlign: "center" as const,
    border: "1px solid #FDE68A",
    marginBottom: "20px",
    marginTop: "8px",
  },
  expiryText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "13px",
    color: "#92400E",
    margin: "0",
  },
  infoBox: {
    backgroundColor: "#FAFAFA",
    borderRadius: "12px",
    border: "1px solid #E4E4E7",
    padding: "16px 20px",
    textAlign: "center" as const,
    marginBottom: "20px",
  },
  infoText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    color: "#3F3F46",
    lineHeight: "1.6",
    margin: "0",
  },
  helpBox: {
    textAlign: "center" as const,
    paddingTop: "16px",
    borderTop: "1px solid #E4E4E7",
  },
  helpText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "13px",
    color: "#71717A",
    margin: "0",
  },
  helpLink: { color: "#EA580C", textDecoration: "underline", fontWeight: 600 },
  footer: {
    backgroundColor: "#18181B",
    padding: "28px 40px",
    textAlign: "center" as const,
  },
  footerBrand: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "13px",
    fontWeight: 700,
    color: "#FB923C",
    margin: "0 0 6px 0",
    letterSpacing: "0.5px",
  },
  footerCompany: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "11px",
    color: "#A1A1AA",
    margin: "0",
  },
  errorText: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "16px",
    color: "#3F3F46",
    lineHeight: "1.6",
    marginBottom: "24px",
  },
  errorMuted: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    color: "#71717A",
  },
  errorLink: { color: "#EA580C", textDecoration: "underline", fontWeight: 600 },
}

const THEMES: Record<string, ProjectTheme> = {
  loslatenboek: loslatenboekTheme,
  dehondenbijbel: dehondenbijbelTheme,
}

function getTheme(projectId?: string): ProjectTheme {
  return THEMES[projectId || "loslatenboek"] || loslatenboekTheme
}

// ── Data fetching ───────────────────────────────────────────────────────

async function getDownloadData(
  token: string
): Promise<{ data: DownloadData | null; error: string | null; expired: boolean; projectId: string }> {
  try {
    const headers: Record<string, string> = {}
    if (PUBLISHABLE_KEY) {
      headers["x-publishable-api-key"] = PUBLISHABLE_KEY
    }

    const res = await fetch(`${BACKEND_URL}/store/download/${token}`, {
      cache: "no-store",
      headers,
    })

    if (res.status === 410) {
      const body = await res.json()
      return { data: null, error: body.message, expired: true, projectId: body.project_id || "loslatenboek" }
    }

    if (res.status === 404) {
      return { data: null, error: "Download niet gevonden", expired: false, projectId: "loslatenboek" }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error("[Download page] Backend error:", res.status, body)
      return { data: null, error: "Er is iets misgegaan", expired: false, projectId: "loslatenboek" }
    }

    const data = await res.json()
    return { data, error: null, expired: false, projectId: data.download?.project_id || "loslatenboek" }
  } catch (err) {
    console.error("[Download page] Fetch error:", err)
    return {
      data: null,
      error: "Kan geen verbinding maken met de server",
      expired: false,
      projectId: "loslatenboek",
    }
  }
}

// ── Page component ──────────────────────────────────────────────────────

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { data, error, expired, projectId } = await getDownloadData(token)
  const t = getTheme(projectId)

  const expiryDate = data?.download?.expires_at
    ? new Date(data.download.expires_at).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const fileEmojis = projectId === "dehondenbijbel"
    ? ["\u{1F4D9}", "\u{1F43E}", "\u{1F3BE}"]  // 📙 🐾 🎾
    : ["\u{1F4D5}", "\u{1F4D3}"]                 // 📕 📓

  return (
    <div style={t.page}>
      <div style={t.container}>
        {/* Header */}
        <div style={t.header}>
          <p style={t.brandLabelStyle}>{t.brandLabel}</p>
          <h1 style={t.headerTitle}>
            {error
              ? expired
                ? "Link verlopen"
                : "Oeps..."
              : projectId === "dehondenbijbel"
                ? "Je e-books staan klaar!"
                : "Je e-books staan klaar"}
          </h1>
        </div>

        {/* Content */}
        <div style={{ padding: "36px 32px" }}>
          {error ? (
            <ErrorState message={error} expired={expired} theme={t} />
          ) : (
            <>
              <p style={t.intro}>
                Hoi! Klik op de downloadknoppen hieronder om je e-books op te
                slaan.
              </p>

              {/* File cards */}
              {data!.download.files.map((file, index) => (
                <div key={index} style={t.fileCard}>
                  <div style={{ fontSize: "32px", flexShrink: 0 }}>
                    {fileEmojis[index % fileEmojis.length]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={t.fileTitle}>{file.title}</p>
                    <p style={t.fileMeta}>
                      {file.description} &bull; {file.size}
                    </p>
                  </div>
                  <a
                    href={file.download_url}
                    style={t.downloadButton}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download &darr;
                  </a>
                </div>
              ))}

              {/* Expiry notice */}
              {expiryDate && (
                <div style={t.expiryNotice}>
                  <p style={t.expiryText}>
                    &#x23F3; Link geldig tot {expiryDate}
                  </p>
                </div>
              )}

              {/* Physical book note */}
              <div style={t.infoBox}>
                <p style={t.infoText}>
                  &#x1F4E6; Je fysieke boek is onderweg en wordt binnen{" "}
                  <strong>4–7 werkdagen</strong> bezorgd. Je ontvangt apart een
                  track &amp; trace code zodra het pakket is verzonden.
                </p>
              </div>
            </>
          )}

          {/* Help */}
          <div style={t.helpBox}>
            <p style={t.helpText}>
              Problemen met de download? Stuur een mailtje naar{" "}
              <a href={`mailto:${t.supportEmail}`} style={t.helpLink}>
                {t.supportEmail}
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={t.footer}>
          <p style={t.footerBrand}>{t.brandName}</p>
          <p style={t.footerCompany}>
            {t.companyName} &bull; {t.companyLocation}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Error state ─────────────────────────────────────────────────────────

function ErrorState({
  message,
  expired,
  theme: t,
}: {
  message: string
  expired: boolean
  theme: ProjectTheme
}) {
  return (
    <div style={{ textAlign: "center" as const, padding: "40px 0" }}>
      <p style={{ fontSize: "48px", marginBottom: "16px" }}>
        {expired ? "\u23F3" : "\u274C"}
      </p>
      <p style={t.errorText}>{message}</p>
      {expired && (
        <p style={t.errorMuted}>
          Neem contact op met{" "}
          <a href={`mailto:${t.supportEmail}`} style={t.errorLink}>
            {t.supportEmail}
          </a>{" "}
          voor een nieuwe download-link.
        </p>
      )}
    </div>
  )
}
