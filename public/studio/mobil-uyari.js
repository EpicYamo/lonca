// Studio telefonda açılırsa (dar ekran ya da dokunmatik küçük cihaz) üstte kapatılabilir bir not gösterir:
// Studio en iyi bilgisayarda çalışır. Giriş penceresi de açık olsa görünsün diye "popover" (üst katman) kullanılır
// ve her yeni pencere açıldığında yeniden en üste alınır. Studio'nun kendi koduna dokunmaz.
(() => {
  const ANAHTAR = "lonca.studio.mobil-uyari";
  const dar = matchMedia("(max-width: 899px)");
  try { if (sessionStorage.getItem(ANAHTAR)) return; } catch {}
  if (!dar.matches || typeof HTMLElement.prototype.showPopover !== "function") return;

  const stil = document.createElement("style");
  stil.textContent = `
    .mobil-uyari { inset: auto 0 auto 0; top: calc(.6rem + env(safe-area-inset-top)); margin: 0 auto; width: min(560px, calc(100% - 1.2rem));
      padding: .85rem .9rem; border: 0; border-radius: 16px; background: var(--metin, #14171c); color: var(--zemin, #f4f5f7);
      box-shadow: 0 10px 40px rgba(0, 0, 0, .28); font: 500 .9rem/1.45 system-ui, -apple-system, Roboto, sans-serif; }
    .mobil-uyari strong { display: block; font-size: .98rem; margin-bottom: .15rem; }
    .mobil-uyari p { margin: 0; opacity: .85; }
    .mobil-uyari .mu-eylemler { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .7rem; }
    .mobil-uyari :is(a, button) { display: inline-flex; align-items: center; min-height: 40px; padding: 0 .9rem; border: 0; border-radius: 10px;
      background: rgba(255, 255, 255, .14); color: inherit; font: 600 .88rem system-ui, -apple-system, Roboto, sans-serif; text-decoration: none; cursor: pointer; }
    :root[data-tema="koyu"] .mobil-uyari :is(a, button) { background: rgba(0, 0, 0, .1); }
    .mobil-uyari .mu-kapat { margin-left: auto; background: none; }
    .mobil-uyari :is(a, button):focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }`;
  document.head.append(stil);

  const kutu = document.createElement("div");
  kutu.className = "mobil-uyari";
  kutu.setAttribute("popover", "manual");
  kutu.setAttribute("role", "note");
  kutu.innerHTML = `<strong>Studio en iyi bilgisayarda çalışır</strong>
    <p>Kalfa, kod ve önizleme yan yana geniş ekran ister. Modülleri telefonda keşfetmek için Lonca uygulamasını kullan; Studio'yu bir bilgisayardan aç.</p>
    <div class="mu-eylemler">
      <a href="/">Lonca'ya dön</a>
      <button type="button" class="mu-kopyala">Bağlantıyı kopyala</button>
      <button type="button" class="mu-kapat">Yine de devam et</button>
    </div>`;
  document.body.append(kutu);

  const ustteTut = () => { if (!kutu.isConnected) return; try { if (kutu.matches(":popover-open")) kutu.hidePopover(); kutu.showPopover(); } catch {} };
  const kapat = () => {
    try { sessionStorage.setItem(ANAHTAR, "1"); } catch {}
    gozcu.disconnect();
    try { kutu.hidePopover(); } catch {}
    kutu.remove();
  };
  kutu.querySelector(".mu-kapat").addEventListener("click", kapat);
  kutu.querySelector(".mu-kopyala").addEventListener("click", async (e) => {
    const adres = `${location.origin}/studio/`;
    try { await navigator.clipboard.writeText(adres); e.target.textContent = "Kopyalandı"; }
    catch { e.target.textContent = adres; }
  });
  // Giriş ya da başka bir pencere açılınca not onun da üstünde kalsın.
  const gozcu = new MutationObserver((kayitlar) => { if (kayitlar.some((k) => k.target.open)) ustteTut(); });
  gozcu.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  ustteTut();
})();
