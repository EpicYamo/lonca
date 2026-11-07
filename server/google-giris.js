// Google ile giriş: sunucu taraflı OAuth 2.0 / OpenID Connect "authorization code" akışı.
// Web, Studio ve Android uygulaması aynı yolu kullanır: tarayıcı (Android'de Custom Tab) /api/hesap/google/baslat'a
// gider, Google'da hesabını seçer, /api/hesap/google/donus'a döner. Sunucu kodu Google'ın token uç noktasında
// istemci sırrıyla takas eder ve kimlik jetonunu (id_token) doğrudan Google'dan TLS ile alır; bu yüzden imzayı ayrıca
// doğrulamak gerekmez (OpenID Connect Core 3.1.3.7), yalnızca iss / aud / exp denetlenir.
// Ayar yoksa (GOOGLE_ISTEMCI_KIMLIGI ya da GOOGLE_ISTEMCI_SIRRI boş) özellik kapalıdır, düğme görünmez.

const YETKI_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GECERLI_ISS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export function googleGirisKur({ ortam = process.env, fetch: fetchFn = globalThis.fetch } = {}) {
  const istemciKimligi = String(ortam.GOOGLE_ISTEMCI_KIMLIGI ?? "").trim();
  const istemciSirri = String(ortam.GOOGLE_ISTEMCI_SIRRI ?? "").trim();
  const sabitDonus = String(ortam.GOOGLE_DONUS_ADRESI ?? "").trim();
  const etkin = !!(istemciKimligi && istemciSirri);

  // Dönüş adresi Google Cloud Console'da birebir kayıtlı olmalı. Ayarlanmadıysa isteğin geldiği adresten türetilir
  // (http://localhost:3000 ve https://kozmos.itaskira.com ayrı ayrı çalışsın diye); vekil arkasında trustProxy sayesinde
  // x-forwarded-proto / host kullanılır.
  const donusAdresi = (req) => sabitDonus || `${req.protocol}://${req.host}/api/hesap/google/donus`;

  function yetkiAdresi({ durum, donus }) {
    const p = new URLSearchParams({
      client_id: istemciKimligi, redirect_uri: donus, response_type: "code",
      scope: "openid email profile", state: durum, prompt: "select_account",
    });
    return `${YETKI_URL}?${p}`;
  }

  /** Kodu takas eder; { sub, eposta, epostaDogrulandi, ad } ya da { hata } döner. */
  async function kodTakas({ kod, donus }) {
    let yanit;
    try {
      yanit = await fetchFn(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: kod, client_id: istemciKimligi, client_secret: istemciSirri, redirect_uri: donus, grant_type: "authorization_code" }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch { return { hata: "Google'a ulaşılamadı; biraz sonra tekrar dene." }; }
    const govde = await yanit.json().catch(() => ({}));
    if (!yanit.ok || typeof govde.id_token !== "string") return { hata: "Google girişi tamamlanamadı." };
    const yuk = jetonGovdesi(govde.id_token);
    if (!yuk) return { hata: "Google kimlik bilgisi okunamadı." };
    if (!GECERLI_ISS.has(yuk.iss) || yuk.aud !== istemciKimligi || !(Number(yuk.exp) * 1000 > Date.now())) {
      return { hata: "Google kimlik bilgisi geçersiz." };
    }
    return { sub: String(yuk.sub ?? ""), eposta: yuk.email, epostaDogrulandi: yuk.email_verified === true || yuk.email_verified === "true", ad: yuk.name };
  }

  return { etkin, donusAdresi, yetkiAdresi, kodTakas };
}

function jetonGovdesi(jeton) {
  const parcalar = jeton.split(".");
  if (parcalar.length !== 3) return null;
  try { return JSON.parse(Buffer.from(parcalar[1], "base64url").toString("utf8")); } catch { return null; }
}
