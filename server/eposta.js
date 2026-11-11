// E-posta gönderimi (şimdilik yalnızca "şifremi unuttum" bağlantısı). SMTP ayarları .env'den okunur:
// SMTP_SUNUCU, SMTP_PORT (varsayılan 587; 465 ise doğrudan TLS), SMTP_KULLANICI, SMTP_SIFRE, EPOSTA_GONDEREN.
// SMTP_SUNUCU boşsa gönderim kapalıdır (etkin: false).
import nodemailer from "nodemailer";

export function epostaKur({ ortam = process.env, gonderici } = {}) {
  // Testler gerçek SMTP yerine kendi göndericisini verir.
  if (gonderici) return { etkin: true, gonder: gonderici };
  const sunucu = String(ortam.SMTP_SUNUCU ?? "").trim();
  if (!sunucu) return { etkin: false, gonder: async () => { throw new Error("E-posta gönderimi kapalı"); } };
  const port = Number(ortam.SMTP_PORT || 587);
  const kullanici = String(ortam.SMTP_KULLANICI ?? "").trim();
  const tasiyici = nodemailer.createTransport({
    host: sunucu, port, secure: port === 465,
    auth: kullanici ? { user: kullanici, pass: String(ortam.SMTP_SIFRE ?? "") } : undefined,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 20_000,
  });
  const gonderen = String(ortam.EPOSTA_GONDEREN ?? "").trim() || kullanici;
  return {
    etkin: true,
    gonder: ({ kime, konu, metin, html }) => tasiyici.sendMail({ from: gonderen, to: kime, subject: konu, text: metin, html }),
  };
}
