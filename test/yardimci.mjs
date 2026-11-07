import { mkdtemp, mkdir, copyFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uygulamaKur } from "../server/uygulama.js";

export const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Kayıt gövdesi: testlerde e-posta ve şifre tekrarı kimlikten/şifreden türetilir (verilmediyse).
export const kayitGovdesi = (g) => ({ eposta: `${g.kimlik}@ornek.test`, sifreTekrar: g.sifre, ...g });

export async function deneySunucusu(ortam = {}, { googleFetch, epostaGonderici } = {}) {
  const veri = await mkdtemp(path.join(tmpdir(), "lonca-test-"));
  await mkdir(path.join(veri, "moduller"), { recursive: true });
  await copyFile(path.join(KOK, "data", "eserler.json"), path.join(veri, "eserler.json"));
  await copyFile(path.join(KOK, "data", "eser-iliskileri.json"), path.join(veri, "eser-iliskileri.json"));
  await writeFile(path.join(veri, "moduller", "index.json"), "[]");
  const { app, kalfa } = await uygulamaKur({ kok: KOK, veri, gunluk: false, googleFetch, epostaGonderici, ortam: { KALFA_SAHTE: "1", YONETICI_SIFRE: "gizli-sifre", HESAP_SINIR: "1000", ...ortam } });
  await app.ready();
  // Atölye uçları (kalfa, modül gönderme) usta hesabı ister; testler için bir usta açılır.
  const ustaKaydi = await app.inject({ method: "POST", url: "/api/hesap/kayit", payload: kayitGovdesi({ kimlik: "test-usta", sifre: "test-sifre-123", rol: "usta" }) });
  const ustaJetonu = ustaKaydi.json().jeton;
  const istek = (method, url, { govde, yonetici = false, usta = false, basliklar = {} } = {}) => app.inject({
    method, url, payload: govde,
    headers: {
      ...(yonetici ? { "x-yonetici-sifre": "gizli-sifre" } : {}),
      ...(usta ? { authorization: `Bearer ${ustaJetonu}` } : {}),
      ...basliklar,
    },
  });
  return { app, kalfa, veri, istek, ustaJetonu };
}
