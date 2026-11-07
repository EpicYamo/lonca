import { timingSafeEqual, createHash, createHmac, randomBytes, scryptSync } from "node:crypto";

const ozet = (s) => createHash("sha256").update(String(s)).digest();

// ---------- Hesap şifreleri (scrypt + tuz) ----------
export function sifreOzetle(sifre) {
  const tuz = randomBytes(16);
  return `${tuz.toString("hex")}:${scryptSync(String(sifre), tuz, 64).toString("hex")}`;
}
export function sifreDogrula(sifre, ozetMetni) {
  const [tuzHex, anahtarHex] = String(ozetMetni ?? "").split(":");
  if (!tuzHex || !anahtarHex) return false;
  const beklenen = Buffer.from(anahtarHex, "hex");
  const gelen = scryptSync(String(sifre), Buffer.from(tuzHex, "hex"), beklenen.length);
  return gelen.length === beklenen.length && timingSafeEqual(gelen, beklenen);
}
// Olmayan kullanıcı adında da aynı süre harcansın (yanıt süresinden hesap var mı anlaşılmasın).
const SAHTE_OZET = sifreOzetle(randomBytes(12).toString("hex"));
export const sifreDogrulaYoksa = (sifre) => { sifreDogrula(sifre, SAHTE_OZET); return false; };

/** Durumsuz, HMAC imzalı oturum jetonu: yalnızca hesap kimliği ve bitiş taşır; rol her istekte hesaptan okunur. */
export function oturumAraclari(anahtar) {
  const gizli = Buffer.from(String(anahtar), "utf8");
  const imzala = (gov) => createHmac("sha256", gizli).update(gov).digest("base64url");
  return {
    jetonUret(yuk, omurMs = 30 * 24 * 60 * 60 * 1000) {
      const gov = Buffer.from(JSON.stringify({ ...yuk, bitis: Date.now() + omurMs })).toString("base64url");
      return `${gov}.${imzala(gov)}`;
    },
    jetonCoz(jeton) {
      if (typeof jeton !== "string" || jeton.length > 2000) return null;
      const [gov, imza, fazla] = jeton.split(".");
      if (!gov || !imza || fazla !== undefined) return null;
      const a = Buffer.from(imza), b = Buffer.from(imzala(gov));
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      try {
        const yuk = JSON.parse(Buffer.from(gov, "base64url").toString());
        return typeof yuk?.id === "string" && yuk.bitis > Date.now() ? yuk : null;
      } catch { return null; }
    },
  };
}

export function yetkiKur(sifre) {
  const beklenen = sifre ? ozet(sifre) : null;
  const yoneticiMi = (req) => {
    if (!beklenen) return true;
    const gelen = req.headers["x-yonetici-sifre"];
    return typeof gelen === "string" && timingSafeEqual(ozet(gelen), beklenen);
  };
  /** Fastify preHandler */
  const yoneticiGerekli = async (req, rep) => {
    if (!yoneticiMi(req)) return rep.code(401).send({ hata: "Bu işlem için yönetici şifresi gerekli" });
  };
  return { yoneticiMi, yoneticiGerekli, sifreli: !!beklenen };
}

export function hizSiniri({ adet, pencereMs, mesaj = "Çok fazla istek; biraz sonra tekrar dene." }) {
  const kayit = new Map(); 
  return async (req, rep) => {
    const simdi = Date.now(), ip = req.ip;
    const liste = (kayit.get(ip) ?? []).filter((t) => simdi - t < pencereMs);
    if (liste.length >= adet) {
      rep.header("retry-after", Math.ceil((pencereMs - (simdi - liste[0])) / 1000));
      return rep.code(429).send({ hata: mesaj });
    }
    liste.push(simdi);
    kayit.set(ip, liste);
    if (kayit.size > 5000) for (const [k, v] of kayit) if (!v.some((t) => simdi - t < pencereMs)) kayit.delete(k);
  };
}
