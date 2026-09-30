import { copyFile, readFile, writeFile } from "node:fs/promises";
import { loadEnv } from "vite";

const base = loadEnv("production", process.cwd(), "VITE_").VITE_BASE_PATH || "/";
if (base !== "/") {
  await copyFile("dist/index.html", "dist/404.html");
  const offline = await readFile("dist/offline.html", "utf8");
  await writeFile("dist/offline.html", offline.replace('src="/icons/', `src="${base}icons/`).replace('href="/"', `href="${base}"`));
  await writeFile("dist/.nojekyll", "");
}