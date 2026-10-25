import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export function jsonDosya(yol, varsayilan) {
  let kuyruk = Promise.resolve();
  return {
    yol,
    async oku() {
      if (!existsSync(yol)) return structuredClone(varsayilan);
      return JSON.parse(await readFile(yol, "utf8"));
    },
    yaz(veri) {
      kuyruk = kuyruk.catch(() => {}).then(async () => {
        await mkdir(path.dirname(yol), { recursive: true });
        const gecici = `${yol}.${process.pid}.tmp`;
        await writeFile(gecici, JSON.stringify(veri, null, 1) + "\n");
        await rename(gecici, yol);
      });
      return kuyruk;
    },
  };
}
