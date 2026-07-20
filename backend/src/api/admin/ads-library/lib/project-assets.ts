// @ts-nocheck
/**
 * Book-cover reference per project — used as the reference image for the
 * "book swap" localization mode.
 *
 * These are MinIO mirrors, not live project URLs on purpose: project domains
 * come and go (a dead www subdomain on jetztloslassen.de was what made the
 * first localization job fail with "fetch failed"), and the pipeline must not
 * depend on any of them being up. Refresh with scripts/mirror-covers.
 */
export const PROJECT_COVERS: Record<string, string | null> = {
  "loslatenboek": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/loslatenboek.webp",
  "lass-los": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/lass-los.png",
  "odpusc-ksiazka": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/odpusc-ksiazka.png",
  "odpust-knizka": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/odpust-knizka.png",
  "pusti-to-sk": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/pusti-to-sk.png",
  "slapp-taget": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/slapp-taget.webp",
  "slipp-taket": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/slipp-taket.png",
  "engedd-el": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/engedd-el.png",
  "lache-livre": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/lache-livre.webp",
  "het-leven": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/het-leven.webp",
  "zivot-zaslugy": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/zivot-zaslugy.png",
  "zycie-zaslugy": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/zycie-zaslugy.png",
  "dehondenbijbel": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/dehondenbijbel.webp",
  "psi-superzivot": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/psi-superzivot.png",
  "kocici-bible": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/kocici-bible.jpg",
  "biblia-kotow": "https://bucket-production-b93e.up.railway.app/medusa-media/ads-library/covers/biblia-kotow.png",
}
