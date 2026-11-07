// Ekran klavyesi takibi (web sitesi ve Studio, telefonda): yazılabilir bir alana odaklanınca alan klavyenin altında kalmaz.
//  - Sayfa görünür alanının yüksekliğini (visualViewport) ve klavyenin kapladığı payı CSS değişkeni olarak verir:
//    --gorunur-yukseklik, --klavye. Alttan sayfalar ve sabit alt çubuklar bunlarla klavyenin üstüne çıkar.
//  - Odaklanan alan, klavye açıldıktan sonra görünür alanın dışındaysa ortaya kaydırılır (iç içe kaydırılan
//    pencerelerde de çalışır).
//  - Klavye açıkken <html>'e "klavye-gorunur" sınıfı eklenir (telefonda alt sekme çubuğu gizlenebilsin).
// Chrome/Android tarafında viewport meta'sındaki interactive-widget=resizes-content düzeni zaten küçültür;
// bu modül iOS Safari gibi küçültmeyen tarayıcılarda aynı sonucu verir ve iki durumda da alanı görünür tutar.
(() => {
  const vv = window.visualViewport;
  const kok = document.documentElement;
  const hareketAz = () => kok.classList.contains("hareket-az") || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const YAZILIR = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=color]), textarea, select, [contenteditable=""], [contenteditable="true"]';

  let sonYukseklik = 0, sonPay = -1;
  function guncelle() {
    if (!vv) return;
    const yukseklik = Math.round(vv.height);
    const pay = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    if (yukseklik !== sonYukseklik) { sonYukseklik = yukseklik; kok.style.setProperty("--gorunur-yukseklik", `${yukseklik}px`); }
    if (pay !== sonPay) { sonPay = pay; kok.style.setProperty("--klavye", `${pay}px`); }
    // Klavye: görünür alan ekranın belirgin biçimde altında kaldıysa (yakınlaştırma değil, yükseklik düşüşü).
    const acik = vv.scale <= 1.01 && screen.height - vv.height > 150 && (document.activeElement?.matches?.(YAZILIR) ?? false);
    kok.classList.toggle("klavye-gorunur", acik);
  }

  function gorunurYap(alan) {
    if (!alan?.isConnected || document.activeElement !== alan) return;
    const r = alan.getBoundingClientRect();
    const ust = vv ? vv.offsetTop : 0;
    const alt = vv ? vv.offsetTop + vv.height : innerHeight;
    const pay = 12;
    // Uzun metin alanında imlecin olduğu alt kısım görünsün diye yalnızca alanın yüksekliği görünür alana sığıyorsa ortala.
    if (r.top < ust + pay || r.bottom > alt - pay) {
      alan.scrollIntoView({ block: r.height > alt - ust - 2 * pay ? "end" : "center", inline: "nearest", behavior: hareketAz() ? "auto" : "smooth" });
    }
  }

  document.addEventListener("focusin", (e) => {
    const alan = e.target;
    if (!alan?.matches?.(YAZILIR) || alan.readOnly || alan.disabled) return;
    if (!matchMedia("(pointer: coarse)").matches) return; // yalnızca dokunmatik cihazlarda ekran klavyesi var
    // Klavye açılış animasyonu bitince bir kez, görünür alan değişince bir kez daha dene.
    setTimeout(() => { guncelle(); gorunurYap(alan); }, 350);
    vv?.addEventListener("resize", () => setTimeout(() => gorunurYap(alan), 60), { once: true });
  });
  document.addEventListener("focusout", () => setTimeout(guncelle, 50));

  vv?.addEventListener("resize", guncelle);
  vv?.addEventListener("scroll", guncelle);
  guncelle();
})();
