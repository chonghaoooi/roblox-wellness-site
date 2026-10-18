import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Square master supplied by the owner (1254x1254, opaque): the +1lean artwork. Regenerate all web icon sizes with:
//   node scripts/generate-app-icons.mjs
const appIcon = await readFile(new URL("../public/assets/lean-master.png", import.meta.url));
const output = new URL("../public/icons/", import.meta.url);
await mkdir(output, { recursive: true });
const out = (name) => fileURLToPath(new URL(name, output));

for (const [filename, size] of [["lean-192.png", 192], ["lean-512.png", 512], ["lean-apple.png", 180]]) {
  await sharp(appIcon).resize(size, size).png({ compressionLevel: 9 }).toFile(out(filename));
}

// Android may crop the icon to a circle or squircle. Shrink the artwork and sit it on a soft, heavily blurred copy of
// itself, so the cropped result has matching red/blue/green surroundings instead of a flat border (and no repeated text).
const INNER = 420;
const background = await sharp(appIcon).resize(512, 512).blur(28).modulate({ brightness: 0.9 }).png().toBuffer();
const inset = await sharp(appIcon).resize(INNER, INNER).png().toBuffer();
await sharp(background)
  .composite([{ input: inset, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(out("lean-maskable-512.png"));

// Small 32px version for browser tabs.
await sharp(appIcon).resize(32, 32).png().toFile(out("lean-32.png"));
console.log("Generated lean-192, lean-512, lean-apple, lean-maskable-512, lean-32");
