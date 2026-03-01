import { Metadata } from "next"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

export const metadata: Metadata = {
  title: "Download je e-books — Laat Los Wat Je Kapotmaakt",
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
    files: DownloadFile[]
  }
}

async function getDownloadData(
  token: string
): Promise<{ data: DownloadData | null; error: string | null; expired: boolean }> {
  try {
    const res = await fetch(`${BACKEND_URL}/store/download/${token}`, {
      cache: "no-store",
    })

    if (res.status === 410) {
      const body = await res.json()
      return { data: null, error: body.message, expired: true }
    }

    if (res.status === 404) {
      return { data: null, error: "Download niet gevonden", expired: false }
    }

    if (!res.ok) {
      return { data: null, error: "Er is iets misgegaan", expired: false }
    }

    const data = await res.json()
    return { data, error: null, expired: false }
  } catch {
    return { data: null, error: "Kan geen verbinding maken met de server", expired: false }
  }
}

export default async function DownloadPage({
  params,
}: {
  params: { token: string }
}) {
  const { data, error, expired } = await getDownloadData(params.token)

  const expiryDate = data?.download?.expires_at
    ? new Date(data.download.expires_at).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <p style={styles.brandLabel}>LAAT LOS WAT JE KAPOTMAAKT</p>
          <h1 style={styles.headerTitle}>
            {error ? (expired ? "Link verlopen" : "Oeps...") : "Je e-books staan klaar"}
          </h1>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {error ? (
            <ErrorState message={error} expired={expired} />
          ) : (
            <>
              <p style={styles.intro}>
                Hoi! Klik op de downloadknoppen hieronder om je e-books op te slaan.
              </p>

              {/* File cards */}
              {data!.download.files.map((file, index) => (
                <div key={index} style={styles.fileCard}>
                  <div style={styles.fileIcon}>
                    {index === 0 ? "📕" : "📓"}
                  </div>
                  <div style={styles.fileInfo}>
                    <p style={styles.fileTitle}>{file.title}</p>
                    <p style={styles.fileMeta}>
                      {file.description} &bull; {file.size}
                    </p>
                  </div>
                  <a
                    href={file.download_url}
                    style={styles.downloadButton}
                    download
                  >
                    Download &darr;
                  </a>
                </div>
              ))}

              {/* Expiry notice */}
              {expiryDate && (
                <div style={styles.expiryNotice}>
                  <p style={styles.expiryText}>
                    &#x23F3; Link geldig tot {expiryDate}
                  </p>
                </div>
              )}

              {/* Physical book note */}
              <div style={styles.infoBox}>
                <p style={styles.infoText}>
                  &#x1F4E6; Je fysieke boek is onderweg en wordt binnen{" "}
                  <strong>4–7 werkdagen</strong> bezorgd. Je ontvangt apart een
                  track &amp; trace code zodra het pakket is verzonden.
                </p>
              </div>
            </>
          )}

          {/* Help */}
          <div style={styles.helpBox}>
            <p style={styles.helpText}>
              Problemen met de download? Stuur een mailtje naar{" "}
              <a
                href="mailto:devries@loslatenboek.nl"
                style={styles.helpLink}
              >
                devries@loslatenboek.nl
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerBrand}>Laat Los Wat Je Kapotmaakt</p>
          <p style={styles.footerCompany}>
            EverChapter OÜ &bull; Tallinn, Estonia
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  expired,
}: {
  message: string
  expired: boolean
}) {
  return (
    <div style={{ textAlign: "center" as const, padding: "40px 0" }}>
      <p style={{ fontSize: "48px", marginBottom: "16px" }}>
        {expired ? "⏳" : "❌"}
      </p>
      <p
        style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: "16px",
          color: "#5A3D6B",
          lineHeight: "1.6",
          marginBottom: "24px",
        }}
      >
        {message}
      </p>
      {expired && (
        <p
          style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: "14px",
            color: "#9B7AAD",
          }}
        >
          Neem contact op met{" "}
          <a
            href="mailto:devries@loslatenboek.nl"
            style={{ color: "#C27BA0", textDecoration: "underline" }}
          >
            devries@loslatenboek.nl
          </a>{" "}
          voor een nieuwe download-link.
        </p>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
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
  brandLabel: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    color: "#C27BA0",
    marginBottom: "10px",
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
  content: {
    padding: "36px 32px",
  },
  intro: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "15px",
    color: "#5A3D6B",
    lineHeight: "1.6",
    marginBottom: "28px",
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
  fileIcon: {
    fontSize: "32px",
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
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
  helpLink: {
    color: "#C27BA0",
    textDecoration: "underline",
  },
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
}
