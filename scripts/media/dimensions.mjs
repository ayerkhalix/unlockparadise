import { realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { mediaContext } from "./context.mjs";
const { db } = await mediaContext();
const apply = process.argv.includes("--apply");
try {
  const root = await realpath("reference/wp-content/uploads");
  const rows =
    await db`select id,original_path from public.media_files where status='ready' and bucket<>'media-archive' and width is null`;
  const updates = [];
  let missing = 0;
  let index = 0;
  async function worker() {
    while (index < rows.length) {
      const row = rows[index++];
      try {
        const file = await realpath(path.resolve(root, row.original_path));
        if (!file.startsWith(root + path.sep)) throw Error("Outside archive");
        const meta = await sharp(file, {
          limitInputPixels: 60000000,
        }).metadata();
        const rotated = (meta.orientation || 0) >= 5;
        if (meta.width && meta.height)
          updates.push({
            id: row.id,
            width: rotated ? meta.height : meta.width,
            height: rotated ? meta.width : meta.height,
          });
      } catch {
        missing++;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  if (apply)
    for (let i = 0; i < updates.length; i += 250) {
      const slice = updates.slice(i, i + 250);
      await db`update public.media_files f set width=v.width,height=v.height from jsonb_to_recordset(${db.json(slice)}::jsonb) as v(id uuid,width int,height int) where f.id=v.id and f.width is null`;
    }
  await writeFile(
    "artifacts/performance-optimization/dimensions.json",
    JSON.stringify({
      checked: rows.length,
      dimensions: updates.length,
      missing,
      applied: apply,
    }),
  );
  console.log(
    JSON.stringify({
      checked: rows.length,
      dimensions: updates.length,
      missing,
      applied: apply,
    }),
  );
} finally {
  await db.end();
}
