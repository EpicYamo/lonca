
const CERCEVE_CSP = "default-src 'none'; script-src 'unsafe-inline' data:";

let sdkKaynagi = null;
async function sdkGetir() {
  sdkKaynagi ??= await (await fetch("/sdk/lonca-sdk.js", { cache: "no-cache" })).text();
  return sdkKaynagi;
}

const BASLATICI = `
window.addEventListener("message", async (e) => {
  if (e.source !== parent || !e.data || e.data.lonca !== 1 || e.data.tur !== "calistir") return;
  try {
    const kod = e.data.kod.replace(
      /import\\s*\\{([^}]*)\\}\\s*from\\s*["']@lonca\\/sdk["'];?/g,
      "const {$1} = globalThis.lonca;"
    );
    const modul = await import("data:text/javascript;charset=utf-8," + encodeURIComponent(kod));
    if (typeof modul.default !== "function") throw new Error("Modül 'export default async function' içermiyor");
    await modul.default();
    parent.postMessage({ lonca: 1, tur: "bitti" }, "*");
  } catch (hata) {
    parent.postMessage({ lonca: 1, tur: "hata", mesaj: String(hata && hata.message || hata) }, "*");
  }
});
parent.postMessage({ lonca: 1, tur: "hazir" }, "*");
`;

const kapat = (s) => s.replaceAll("</script", "<\\/script");

export async function modulCalistir(kod, yontemlerYap, { iptal } = {}) {
  const sdk = await sdkGetir();
  const cerceve = document.createElement("iframe");
  cerceve.setAttribute("sandbox", "allow-scripts");
  cerceve.setAttribute("aria-hidden", "true");
  cerceve.tabIndex = -1;
  cerceve.style.display = "none";
  cerceve.srcdoc = `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CERCEVE_CSP}">
<script>${kapat(sdk)}</script><script>${kapat(BASLATICI)}</script>`;

  const gonder = (olay) => cerceve.contentWindow?.postMessage({ lonca: 1, tur: "olay", olay }, "*");
  // Oyun akışı (kare, dokunma, klavye): yanıt beklenmeyen ham mesaj. Çerçeve kapandıysa false döner (döngü durur).
  const ham = (veri) => {
    const w = cerceve.isConnected ? cerceve.contentWindow : null;
    if (!w) return false;
    w.postMessage({ ...veri, lonca: 1 }, "*");
    return true;
  };
  const yontemler = typeof yontemlerYap === "function" ? yontemlerYap(gonder, ham) : yontemlerYap;

  return new Promise((coz, reddet) => {
    const bitir = (hata) => {
      window.removeEventListener("message", dinle);
      cerceve.remove();
      hata ? reddet(hata) : coz();
    };

    async function dinle(e) {
      if (e.source !== cerceve.contentWindow) return; 
      const m = e.data;
      if (!m || m.lonca !== 1) return;

      if (m.tur === "hazir") return cerceve.contentWindow.postMessage({ lonca: 1, tur: "calistir", kod }, "*");
      if (m.tur === "bitti") return bitir();
      if (m.tur === "hata") return bitir(new Error(m.mesaj));
      // Çizim komutları ve kare onayı: yanıtsız, sıradan SDK çağrısı değil.
      if (m.tur === "akis") return yontemler._akis?.(m.veri);

      const yanit = (veri) => cerceve.contentWindow?.postMessage({ lonca: 1, id: m.id, ...veri }, "*");
      const yontem = typeof m.yontem === "string" && !m.yontem.startsWith("_") && Object.hasOwn(yontemler, m.yontem) ? yontemler[m.yontem] : null;
      if (!yontem) return yanit({ ok: false, hata: `Bilinmeyen SDK yöntemi: ${m.yontem}` });
      try {
        yanit({ ok: true, sonuc: await yontem(...(Array.isArray(m.args) ? m.args : [])) });
      } catch (hata) {
        yanit({ ok: false, hata: String(hata?.message ?? hata) });
      }
    }

    window.addEventListener("message", dinle);
    iptal?.addEventListener("abort", () => bitir(Object.assign(new Error("Modül kapatıldı"), { iptal: true })), { once: true });
    document.body.append(cerceve);
  });
}
