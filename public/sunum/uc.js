// Sunumun 3B sahneleri (Three.js, sunucunun /vendor/three/ adresinden; yeni bağımlılık yok).
// "duvar": kapak ve kapanışta eser fotoğraflarından dönen silindir. "harita": ölçek sayfasında gerçek eser noktaları
// ve il sütunları. Tek tuval paylaşılır; sayfa değişince sahne değişir, kullanılmayan sahne çizilmez.
import * as THREE from "three";
import { NOKTALAR } from "/sunum/veri.js";

const { gsap } = window;
const tuval = document.getElementById("uc-tuval");
let cizici = null;
try {
  cizici = new THREE.WebGLRenderer({ canvas: tuval, antialias: true, alpha: true });
  cizici.setPixelRatio(Math.min(devicePixelRatio, 2));
} catch { cizici = null; } // WebGL yoksa sunum 3B arka plansız sürer.

let etkin = null; // { sahne, kamera, adim(t), kapat() }
let kare = 0;

export function boyutla() {
  if (!cizici) return;
  cizici.setSize(innerWidth, innerHeight, false);
  if (etkin) { etkin.kamera.aspect = innerWidth / innerHeight; etkin.kamera.updateProjectionMatrix(); etkin.boyut?.(); }
}

export function sec(ad, sayfa) {
  if (!cizici) return;
  const yeni = ad === "duvar" ? duvar() : ad === "harita" ? harita(sayfa) : null;
  const eski = etkin;
  etkin = yeni;
  eski?.kapat();
  gsap.to(tuval, { opacity: !yeni ? 0 : ad === "duvar" ? 0.55 : 1, duration: 0.8 });
  boyutla();
  cancelAnimationFrame(kare);
  if (yeni) {
    const saat = new THREE.Clock();
    const dongu = () => { if (etkin !== yeni) return; yeni.adim(saat.getElapsedTime()); cizici.render(yeni.sahne, yeni.kamera); kare = requestAnimationFrame(dongu); };
    dongu();
  }
}

// ── Fotoğraf duvarı ──────────────────────────────────────────────────────────────────────────
const FOTOLAR = [
  "bursa-ulucami-1", "bursa-koza-hani-1", "bursa-emir-sultan-kulliyesi-1", "bursa-yesil-turbe-1", "bursa-incirli-hamami-1", "bursa-selimiye-camii-1",
  "bursa-haci-sevindik-camii-1", "bursa-alanyeri-mescidi-1", "bursa-mecidiye-camii-1", "bursa-ic-koza-hani-1", "bursa-yildirim-bayezid-turbesi-1",
  "bursa-kiremitci-sinan-bey-camii-1", "bursa-yarhisar-koyu-cesmesi-1", "bursa-ozluce-kilisesi-camii-1", "konya-hocacihan-sarnici-1", "konya-emir-kandemir-hani-1",
  "konya-kurkcu-mescidi-1", "konya-ismail-aga-medresesi-tas-medrese-1", "konya-kucuk-ayasofya-mescidi-1", "konya-mahkeme-yeni-hamami-1", "konya-ihsaniye-ulu-camii-minaresi-1",
  "konya-nuriye-camii-1", "konya-seyit-harun-veli-turbesi-1", "hatay-ulu-camii-ve-kulliyesi-1", "hatay-kanuni-sultan-suleyman-kervansarayi-1", "hatay-kursunlu-han-1",
  "hatay-semerciler-mescidi-1", "hatay-fatikli-camii-1", "hatay-reyhanli-yenisehir-degirmeni-1", "bursa-ulucami-2",
];
let duvarOnbellek = null;

function duvar() {
  if (!duvarOnbellek) {
    const sahne = new THREE.Scene();
    sahne.fog = new THREE.Fog(0x081227, 8, 22);
    const kamera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
    const grup = new THREE.Group();
    sahne.add(grup);
    const yukleyici = new THREE.TextureLoader();
    const sira = 3, adet = 14, R = 9;
    for (let s = 0; s < sira; s++) {
      for (let i = 0; i < adet; i++) {
        const ad = FOTOLAR[(s * adet + i) % FOTOLAR.length];
        const doku = yukleyici.load(`/medya/eserler/${ad}.jpg`);
        doku.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1), new THREE.MeshBasicMaterial({ map: doku, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
        const a = (i / adet) * Math.PI * 2 + s * 0.22;
        m.position.set(Math.cos(a) * R, (s - 1) * 2.5, Math.sin(a) * R);
        m.lookAt(0, (s - 1) * 2.5, 0);
        grup.add(m);
      }
    }
    // Toz parçacıkları
    const g = new THREE.BufferGeometry();
    const n = 500, p = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) p[i] = (Math.random() - 0.5) * 30;
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const toz = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe6c477, size: 0.05, transparent: true, opacity: 0.7 }));
    sahne.add(toz);
    duvarOnbellek = { sahne, kamera, grup, toz };
  }
  const { sahne, kamera, grup, toz } = duvarOnbellek;
  kamera.position.set(0, 0, 0.1);
  const giris = { z: -0.8 };
  gsap.fromTo(giris, { z: -0.8 }, { z: 0, duration: 2.5, ease: "power3.out" });
  return {
    sahne, kamera,
    adim(t) {
      grup.rotation.y = t * 0.06 + giris.z;
      grup.rotation.x = Math.sin(t * 0.2) * 0.04;
      toz.rotation.y = -t * 0.02;
      kamera.position.x = Math.sin(t * 0.15) * 0.6;
      kamera.lookAt(Math.sin(t * 0.1) * 2 + 4, Math.sin(t * 0.13) * 0.4, -6);
    },
    kapat() {},
  };
}

// ── Ölçek haritası ───────────────────────────────────────────────────────────────────────────
const ILLER = [
  { ad: "Bursa", lat: 40.18, lng: 29.06, n: 165 },
  { ad: "Konya", lat: 37.87, lng: 32.49, n: 263 },
  { ad: "Hatay", lat: 36.2, lng: 36.16, n: 77 },
  { ad: "İzmir", lat: 38.42, lng: 27.14, n: 0, yeni: true },
  { ad: "Manisa", lat: 38.61, lng: 27.43, n: 0, yeni: true },
];
const yer = (lat, lng) => new THREE.Vector3((lng - 32) * 0.9, 0, -(lat - 38.6) * 1.15);

function harita(sayfa) {
  const sahne = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
  const kok = new THREE.Group();
  sahne.add(kok);

  // Enlem/boylam ızgarası (Türkiye'yi 26°-45° D, 36°-42° K aralığında kapsar)
  const izgara = [];
  for (let ln = 26; ln <= 45; ln += 1) izgara.push(yer(35.8, ln), yer(42.2, ln));
  for (let la = 36; la <= 42; la += 1) izgara.push(yer(la, 25.8), yer(la, 45.2));
  kok.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(izgara), new THREE.LineBasicMaterial({ color: 0x2a4a8f, transparent: true, opacity: 0.45 })));

  // Gerçek eser konumları
  const p = new Float32Array(NOKTALAR.length * 3);
  NOKTALAR.forEach(([la, ln], i) => { const v = yer(la, ln); p.set([v.x, 0.02, v.z], i * 3); });
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const noktaMalzeme = new THREE.PointsMaterial({ color: 0xffe3f1, size: 0.14, transparent: true, opacity: 0 });
  kok.add(new THREE.Points(ng, noktaMalzeme));

  // İl sütunları ve yeni il halkaları
  const sutunlar = [], halkalar = [];
  for (const il of ILLER) {
    const v = yer(il.lat, il.lng);
    if (il.yeni) {
      const h = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 48), new THREE.MeshBasicMaterial({ color: 0x3fd497, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
      h.rotation.x = -Math.PI / 2; h.position.set(v.x, 0.03, v.z);
      kok.add(h); halkalar.push(h);
    } else {
      const yuk = il.n / 60;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 32), new THREE.MeshBasicMaterial({ color: 0xe2338a, transparent: true, opacity: 0.85 }));
      m.position.set(v.x, 0, v.z); m.scale.y = 0.001; m.userData = { yuk };
      kok.add(m); sutunlar.push(m);
      const taban = new THREE.Mesh(new THREE.CircleGeometry(0.6, 48), new THREE.MeshBasicMaterial({ color: 0xe2338a, transparent: true, opacity: 0.15 }));
      taban.rotation.x = -Math.PI / 2; taban.position.set(v.x, 0.01, v.z); kok.add(taban);
    }
  }

  // Etiketler: 3B konum her karede ekrana izdüşürülür, 1920×1080 tuval koordinatına çevrilir.
  const kap = sayfa.querySelector(".olcek-etiketler");
  kap.innerHTML = "";
  const etiketler = ILLER.map((il) => {
    const s = document.createElement("span");
    s.textContent = il.yeni ? `${il.ad} +` : `${il.ad} · ${il.n}`;
    if (il.yeni) s.className = "yeni";
    kap.append(s);
    return { s, il };
  });

  const durum = { aci: -0.5, yuk: 0 };
  const zt = gsap.timeline();
  zt.to(noktaMalzeme, { opacity: 1, duration: 1.5 }, 0.3)
    .to(durum, { yuk: 1, duration: 1.6, ease: "power3.out" }, 0.8)
    .to(etiketler.filter((e) => !e.il.yeni).map((e) => e.s), { opacity: 1, stagger: 0.15, duration: 0.4 }, 1.2)
    .to(halkalar.map((h) => h.material), { opacity: 1, duration: 0.6, stagger: 0.3 }, 2.6)
    .to(etiketler.filter((e) => e.il.yeni).map((e) => e.s), { opacity: 1, stagger: 0.3, duration: 0.4 }, 2.6);
  const v = new THREE.Vector3();
  const merkez = yer(38.4, 31.5);
  return {
    sahne, kamera,
    boyut() { kamera.setViewOffset(innerWidth, innerHeight, innerWidth * 0.2, -innerHeight * 0.14, innerWidth, innerHeight); },
    adim(t) {
      const a = durum.aci + Math.sin(t * 0.15) * 0.18;
      kamera.position.set(merkez.x + Math.sin(a) * 15, 10, merkez.z + Math.cos(a) * 15);
      kamera.lookAt(merkez);
      sutunlar.forEach((m) => { const h = Math.max(0.001, m.userData.yuk * durum.yuk); m.scale.y = h; m.position.y = h / 2; });
      halkalar.forEach((h, i) => { const s = 1 + ((t * 0.6 + i * 0.5) % 1) * 0.8; h.scale.set(s, s, s); });
      const k = Math.min(innerWidth / 1920, innerHeight / 1080);
      const ox = (innerWidth - 1920 * k) / 2, oy = (innerHeight - 1080 * k) / 2;
      etiketler.forEach(({ s, il }, i) => {
        const m = sutunlar.find((x) => Math.abs(x.position.x - yer(il.lat, il.lng).x) < 1e-6);
        v.copy(yer(il.lat, il.lng)); v.y = m ? m.scale.y + 0.2 : 0.4;
        v.project(kamera);
        const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight;
        s.style.left = `${(px - ox) / k}px`; s.style.top = `${(py - oy) / k}px`;
        if (il.ad === "Manisa") s.style.transform = "translate(-10%, -150%)";
        if (il.ad === "İzmir") s.style.transform = "translate(-90%, 20%)";
        void i;
      });
    },
    kapat() { zt.kill(); },
  };
}

export function olcekOyna() {}
