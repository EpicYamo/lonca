import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { TilesRenderer, GoogleCloudAuthPlugin, ReorientationPlugin, TilesFadePlugin, GLTFExtensionsPlugin } from "/vendor-yerel/uc-karolar.js";
import { hareketAzalt } from "/ortak/animasyon.js";

const ODAKLAR = {
  genel: { yukseklik: 12, uzaklik: 190, aci: [0.6, 0.48] },
  yakin: { yukseklik: 6, uzaklik: 70, aci: [0.15, 0.16] },
  cati: { yukseklik: 22, uzaklik: 80, aci: [0.95, 0.55] },
  yan: { yukseklik: 10, uzaklik: 95, aci: [1.6, 0.22] },
  arka: { yukseklik: 6, uzaklik: 110, aci: [2.9, 0.3] },
  ust: { yukseklik: 0, uzaklik: 300, aci: [0.01, 1.45] },
};
export const GERCEK_ODAK_ADI = { genel: "Genel görünüm", yakin: "Yakından", cati: "Çatı", yan: "Yandan", arka: "Arkadan", ust: "Kuşbakışı" };

let draco = null;

export async function gercekUcKur(kap, { anahtar, eser, odak = "genel", noktalar = true, onOdak }) {
  const tuval = document.createElement("canvas");
  tuval.className = "uc-tuval";
  tuval.setAttribute("role", "img");
  tuval.setAttribute("aria-label", `${eser?.ad ?? "Yapı"} ve çevresinin gerçek 3B görünümü (Google). Sürükleyerek çevirebilirsin.`);
  const yukleniyor = Object.assign(document.createElement("div"), { className: "uc-yukleniyor", textContent: "Gerçek 3B yükleniyor…" });
  const atif = Object.assign(document.createElement("div"), { className: "uc-atif" });
  const cipler = Object.assign(document.createElement("div"), { className: "uc-cipler" });
  kap.append(tuval, yukleniyor, atif, cipler);

  const renderer = new THREE.WebGLRenderer({ canvas: tuval, antialias: true, alpha: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const sahne = new THREE.Scene();
  sahne.add(new THREE.AmbientLight(0xffffff, 3));
  const kamera = new THREE.PerspectiveCamera(50, 1, 1, 30000);

  draco ??= new DRACOLoader().setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/");
  const karolar = new TilesRenderer();
  karolar.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: anahtar, autoRefreshToken: true }));
  karolar.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
  karolar.registerPlugin(new TilesFadePlugin());
  karolar.registerPlugin(new ReorientationPlugin({ lat: eser.konum.lat * THREE.MathUtils.DEG2RAD, lon: eser.konum.lng * THREE.MathUtils.DEG2RAD, height: 0, recenter: true }));
  karolar.errorTarget = 6;
  karolar.setCamera(kamera);
  sahne.add(karolar.group);

  const kontrol = new OrbitControls(kamera, tuval);
  kontrol.enableDamping = true;
  kontrol.maxPolarAngle = Math.PI * 0.48;
  kontrol.minDistance = 15; kontrol.maxDistance = 1500;
  kontrol.autoRotateSpeed = 0.35;

  let yerY = 180, yerBulundu = false;
  const isin = new THREE.Raycaster(new THREE.Vector3(0, 5000, 0), new THREE.Vector3(0, -1, 0));
  function yerBul() {
    const vurus = isin.intersectObject(karolar.group, true)[0];
    if (!vurus) return false;
    const fark = vurus.point.y - yerY;
    yerY = vurus.point.y;
    if (!yerBulundu || Math.abs(fark) > 2) { 
      kontrol.target.y += fark; kamera.position.y += fark;
      if (ucus) { ucus.k1.y += fark; ucus.t1.y += fark; }
    }
    yerBulundu = true;
    return true;
  }

  const hedefOdak = (ad) => {
    const o = ODAKLAR[ad] ?? ODAKLAR.genel;
    return { hedef: new THREE.Vector3(0, yerY + o.yukseklik, 0), uzaklik: o.uzaklik, aci: o.aci };
  };
  const konumHesapla = (o) => new THREE.Vector3(
    o.hedef.x + Math.sin(o.aci[0]) * Math.cos(o.aci[1]) * o.uzaklik,
    o.hedef.y + Math.sin(o.aci[1]) * o.uzaklik,
    o.hedef.z + Math.cos(o.aci[0]) * Math.cos(o.aci[1]) * o.uzaklik);

  let ucus = null, simdiki = null;
  function git(ad) {
    if (!ODAKLAR[ad]) ad = "genel";
    simdiki = ad;
    cipleriCiz();
    const o = hedefOdak(ad), k1 = konumHesapla(o);
    kontrol.autoRotate = false;
    if (hareketAzalt()) { kamera.position.copy(k1); kontrol.target.copy(o.hedef); return Promise.resolve(); }
    return new Promise((coz) => { ucus = { bas: performance.now(), sure: 2200, k0: kamera.position.clone(), t0: kontrol.target.clone(), k1, t1: o.hedef.clone(), coz, ad }; });
  }

  function cipleriCiz() {
    if (!noktalar) return;
    cipler.replaceChildren(...["genel", "yakin", "cati", "ust"].map((ad) => {
      const d = Object.assign(document.createElement("button"), { type: "button", className: `uc-cip${ad === simdiki ? " secili" : ""}`, textContent: GERCEK_ODAK_ADI[ad] });
      d.setAttribute("aria-pressed", String(ad === simdiki));
      d.addEventListener("click", () => { git(ad); onOdak?.(ad); });
      return d;
    }));
  }

  function boyutla() {
    const { clientWidth: w, clientHeight: h } = kap;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h; kamera.updateProjectionMatrix();
    karolar.setResolutionFromRenderer(kamera, renderer);
  }
  const gozlemci = new ResizeObserver(boyutla);
  gozlemci.observe(kap);
  boyutla();

  const ilk = hedefOdak(odak);
  kamera.position.copy(konumHesapla({ ...ilk, uzaklik: ilk.uzaklik * 3, aci: [ilk.aci[0] - 0.8, Math.min(1.3, ilk.aci[1] + 0.5)] }));
  kontrol.target.copy(ilk.hedef);

  const yumusat = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let calisiyor = true, sonYerDenemesi = 0, modelSayisi = 0;
  karolar.addEventListener("load-model", () => { modelSayisi++; });
  const atifGuncelle = () => {
    const metinler = karolar.getAttributions().map((a) => a.value).filter((v) => typeof v === "string");
    atif.textContent = ["Google", ...new Set(metinler)].join(" · ");
  };
  karolar.addEventListener("tiles-load-end", atifGuncelle);

  renderer.setAnimationLoop((zaman) => {
    if (!calisiyor) return;
    if (!yerBulundu || zaman - sonYerDenemesi > 1500) {
      if (zaman - sonYerDenemesi > 400) { sonYerDenemesi = zaman; if (modelSayisi && yerBul() && !yukleniyor.hidden) { yukleniyor.hidden = true; git(odak).then(() => { if (simdiki === "genel") kontrol.autoRotate = true; }); } }
    }
    if (ucus) {
      const t = Math.min(1, (zaman - ucus.bas) / ucus.sure), e = yumusat(t);
      kamera.position.lerpVectors(ucus.k0, ucus.k1, e);
      kamera.position.y += Math.sin(Math.PI * t) * 25;
      kontrol.target.lerpVectors(ucus.t0, ucus.t1, e);
      if (t >= 1) { const u = ucus; ucus = null; if (u.ad === "genel") kontrol.autoRotate = true; u.coz(); }
    }
    kontrol.update();
    kamera.updateMatrixWorld();
    karolar.update();
    renderer.render(sahne, kamera);
  });

  const api = {
    gercek: true,
    get odaklar() { return Object.keys(ODAKLAR); },
    get simdiki() { return simdiki; },
    git,
    guncelle(o) { if (o.odak && o.odak !== simdiki) git(o.odak); },
    yokEt() { calisiyor = false; renderer.setAnimationLoop(null); gozlemci.disconnect(); kontrol.dispose(); karolar.dispose(); renderer.dispose(); },
  };

  await new Promise((coz, reddet) => {
    const sinir = setTimeout(() => { if (!modelSayisi) { api.yokEt(); kap.replaceChildren(); reddet(new Error("Google 3B yüklenemedi")); } }, 12000);
    karolar.addEventListener("load-model", () => { clearTimeout(sinir); coz(); }, { once: true });
    karolar.addEventListener("load-error", (e) => console.warn("Google 3B karo hatası:", e.error?.message ?? e));
  });
  return api;
}
