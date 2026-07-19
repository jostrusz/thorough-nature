// @ts-nocheck
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"

/**
 * Mirror a remote (signed, expiring) Meta CDN image into MinIO so the
 * library keeps a permanent copy. Returns the public MinIO URL.
 */
const BUCKET = process.env.MINIO_BUCKET || "medusa-media"

function s3(): S3Client {
  const endpoint = "https://bucket-production-b93e.up.railway.app"
  return new S3Client({
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY,
      secretAccessKey: process.env.MINIO_SECRET_KEY,
    },
  })
}

export async function mirrorImage(url: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const type = res.headers.get("content-type") || "image/jpeg"
    await s3().send(new PutObjectCommand({
      Bucket: BUCKET, Key: key, Body: buf, ContentType: type, ACL: "public-read",
    }))
    const pub = (process.env.MINIO_PUBLIC_ENDPOINT || "https://bucket-production-b93e.up.railway.app")
      .replace(/:443$/, "")
    return `${pub}/${BUCKET}/${key}`
  } catch (e) {
    console.warn(`[Ads Library] mirrorImage failed: ${e.message}`)
    return null
  }
}
