import { timingSafeEqual, createHash } from "node:crypto";

const ozet = (s) => createHash("sha256").update(String(s)).digest();

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
