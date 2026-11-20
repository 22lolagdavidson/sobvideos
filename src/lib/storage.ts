import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * File storage for PDFs, audio, captions and MP4s.
 * S3_DRIVER=local (default in dev) writes under ./storage/files; S3_DRIVER=s3 uses any
 * S3-compatible service (AWS S3, Cloudflare R2, MinIO). Keys look like "plans/<id>/doc.pdf".
 * Files are always served through the app (with a permission check), never by public URL.
 */

const LOCAL_ROOT = path.join(process.cwd(), "storage", "files");
const driver = () => (process.env.S3_DRIVER || "local").toLowerCase();

let s3: S3Client | null = null;
function client() {
  s3 ??= new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: process.env.S3_ACCESS_KEY_ID
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" }
      : undefined,
  });
  return s3;
}

function localPath(key: string) {
  const p = path.resolve(LOCAL_ROOT, key);
  if (!p.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Bad storage key");
  return p;
}

export async function putFile(key: string, body: Buffer | Uint8Array, contentType: string) {
  if (driver() === "s3") {
    await client().send(
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: "AES256" }),
    );
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function getFile(key: string): Promise<Buffer> {
  if (driver() === "s3") {
    const r = await client().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function fileExists(key: string): Promise<boolean> {
  if (driver() === "s3") {
    try {
      await getFile(key);
      return true;
    } catch {
      return false;
    }
  }
  return stat(localPath(key)).then(() => true, () => false);
}
