import { mkdtemp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uygulamaKur } from "../server/uygulama.js";

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function deneySunucusu(ortam = {}) {
  const veri = await mkdtemp(path.join(tmpdir(), "lonca-test-"));
  await mkdir(path.join(veri, "moduller"), { recursive: true });
  await copyFile(path.join(KOK, "data", "eserler.json"), path.join(veri, "eserler.json"));
  await writeFile(path.join(veri, "moduller", "index.json"), "[]");
  const { app, kalfa } = await uygulamaKur({ kok: KOK, veri, gunluk: false, ortam: { KALFA_SAHTE: "1", YONETICI_SIFRE: "gizli-sifre", ...ortam } });
  await app.ready();
  const istek = (method, url, { govde, yonetici = false, basliklar = {} } = {}) => app.inject({
    method, url, payload: govde,
    headers: { ...(yonetici ? { "x-yonetici-sifre": "gizli-sifre" } : {}), ...basliklar },
  });
  return { app, kalfa, veri, istek };
}
