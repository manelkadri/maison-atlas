export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif"; ext: "jpg" | "png" | "webp" | "avif" };

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

/**
 * Détecte le vrai format d'une image d'après ses premiers octets (« magic bytes »).
 * Le type MIME et l'extension envoyés par le client sont ignorés : ils sont triviaux à falsifier.
 */
export function detectImageKind(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(buf, 4, 8) === "ftyp") {
    // Boîte ISO-BMFF : marque principale puis marques compatibles (4 octets chacune, après 4 octets de version).
    const boxSize = Math.min(buf.readUInt32BE(0), 64, buf.length);
    const brands = [ascii(buf, 8, 12)];
    for (let i = 16; i + 4 <= boxSize; i += 4) brands.push(ascii(buf, i, i + 4));
    if (brands.some((b) => b === "avif" || b === "avis")) return { mime: "image/avif", ext: "avif" };
  }
  return null;
}
