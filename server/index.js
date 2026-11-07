import { fileURLToPath } from "node:url";
import path from "node:path";
import { uygulamaKur } from "./uygulama.js";

try { process.loadEnvFile(); } catch {}

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 3000);

const { app, kalfa, yetki, erisim } = await uygulamaKur({ kok: KOK });
await app.listen({ port: PORT, host: "0.0.0.0" });
app.log.info(`Kalfa: ${kalfa.sahte ? "SAHTE (yapay zekâ bağlı değil)" : kalfa.model}`);
if (!erisim.gerekli) app.log.warn("LONCA_API_ANAHTARI tanımlı değil: /api uçları ağdaki herkese açık.");
if (!yetki.sifreli) app.log.warn("YONETICI_SIFRE tanımlı değil: geliştirme modu, Studio'daki onay/silme işlemleri şifresiz açık.");
if (!process.env.GOOGLE_HARITA_ANAHTARI) app.log.info("GOOGLE_HARITA_ANAHTARI yok: harita OpenStreetMap ile çalışır, gerçek 3B kapalı.");
