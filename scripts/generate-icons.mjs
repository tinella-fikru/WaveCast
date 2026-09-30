import sharp from "sharp";
import { mkdir } from "node:fs/promises";

await mkdir("public/icons", { recursive: true });
const artwork = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="#111413"/><g stroke="#84e0bd" stroke-width="28" stroke-linecap="round"><path d="M144 224v64M200 176v160M256 128v256M312 176v160M368 224v64"/></g></svg>',
);
await Promise.all(
  [192, 512].map((size) =>
    sharp(artwork)
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`),
  ),
);
await sharp(artwork).png().toFile("public/icons/maskable-512.png");
