const PROMO_URL = "https://www.pakjeleventerug.nl"
const BOOK_IMAGE = "https://www.pakjeleventerug.nl/het-leven-dat-je-verdient-380w.webp"

const styles = {
  eyebrow: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "1.5px",
    color: "#9B7AAD",
    margin: "8px 0 12px",
    textAlign: "center" as const,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    backgroundColor: "#FAF5F8",
    borderRadius: "12px",
    border: "1px solid #EDD9E5",
    padding: "16px 18px",
    marginBottom: "20px",
    textDecoration: "none",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  },
  image: {
    width: "94px",
    height: "auto",
    flexShrink: 0,
    borderRadius: "6px",
    display: "block",
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#2D1B3D",
    margin: "0 0 4px",
    lineHeight: 1.3,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  desc: {
    fontSize: "12px",
    color: "#5A3D6B",
    margin: "0 0 8px",
    lineHeight: 1.5,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  cta: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#C27BA0",
    margin: 0,
    fontFamily: "'Inter', Arial, sans-serif",
  },
}

export function CrossPromoLB() {
  return (
    <>
      <p style={styles.eyebrow}>✦ De volgende stap voor jou</p>
      <a href={PROMO_URL} style={styles.card} target="_blank" rel="noopener noreferrer">
        <img src={BOOK_IMAGE} alt="Het Leven Dat Je Verdient" style={styles.image} />
        <div style={styles.text}>
          <p style={styles.title}>Het Leven Dat Je Verdient</p>
          <p style={styles.desc}>
            Loslaten was de eerste stap. Nu is het tijd om je leven terug te pakken — met de LIFE RESET™ methode in 5 pijlers.
          </p>
          <p style={styles.cta}>Ontdek het boek →</p>
        </div>
      </a>
    </>
  )
}
