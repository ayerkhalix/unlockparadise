export function fileMime(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  if (/^GIF8[79]a/.test(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.toString("ascii", 4, 8) === "ftyp") {
    const brands = bytes.toString("ascii", 8, 64);
    if (/avif|avis/.test(brands)) return "image/avif";
    if (/heic|heix|hevc|hevx/.test(brands)) return "image/heic";
    if (/mif1|msf1/.test(brands)) return "image/heif";
  }
  if (/<svg[\s>]/i.test(bytes.toString("utf8", 0, 4096)))
    return "image/svg+xml";
  return null;
}
export function validMime(bytes, expected) {
  const actual = fileMime(bytes);
  return (
    actual === expected ||
    (expected === "application/octet-stream" && actual !== null) ||
    (["image/heic", "image/heif"].includes(expected) &&
      ["image/heic", "image/heif"].includes(actual))
  );
}
