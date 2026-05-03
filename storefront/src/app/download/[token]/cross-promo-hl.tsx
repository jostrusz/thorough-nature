const PROMO_URL = "https://loslatenboek.nl"
const BOOK_IMAGE = "https://www.loslatenboek.nl/Laat-los-wat-je-kapotmaakt-book-pichi.png"

const styles = {
  eyebrow: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "1.5px",
    color: "#8A7884",
    margin: "8px 0 12px",
    textAlign: "center" as const,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    backgroundColor: "#FFF8F3",
    borderRadius: "12px",
    border: "1px solid #F0DCC4",
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
    color: "#2D1B26",
    margin: "0 0 4px",
    lineHeight: 1.3,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  desc: {
    fontSize: "12px",
    color: "#5A3D40",
    margin: "0 0 8px",
    lineHeight: 1.5,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  cta: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#B85C4A",
    margin: 0,
    fontFamily: "'Inter', Arial, sans-serif",
  },
}

export function CrossPromoHL() {
  return (
    <>
      <p style={styles.eyebrow}>✦ Misschien ook iets voor jou</p>
      <a href={PROMO_URL} style={styles.card} target="_blank" rel="noopener noreferrer">
        <img src={BOOK_IMAGE} alt="Laat los wat je kapotmaakt" style={styles.image} />
        <div style={styles.text}>
          <p style={styles.title}>Laat los wat je kapotmaakt</p>
          <p style={styles.desc}>
            Stop met overdenken. Kalmeer je emoties. Vind innerlijke rust — in 290 pagina's praktisch werkboek.
          </p>
          <p style={styles.cta}>Ontdek het boek →</p>
        </div>
      </a>
    </>
  )
}
