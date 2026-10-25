#!/usr/bin/env python3
"""Envanter kitaplarındaki gerçek fotoğrafları çıkarıp eserlere bağlar.

Kullanım:
  python3 araclar/foto-cikar.py ham.json kitaplar/bursa-envanteri-cilt-*.pdf > data/bursa-fotograflar.json

- pdftohtml -xml her fotoğrafı sayfadaki yeriyle birlikte verir. Her PDF sayfası iki kitap sayfalık bir açılım:
  fotoğrafın ortası sol yarıdaysa taraf 0, sağdaysa 1.
- Fotoğraf, kitapta kendisinden önce başlayan son esere aittir (ham.json'daki kitap_yeri).
  Açılımın tamamını kaplayan bölüm kapakları ise bir SONRAKİ esere aittir.
- Küçük görseller (logo, süs, çizim parçaları) atlanır. Her eser için en büyük ilk FOTO_SINIRI fotoğraf,
  1280 piksel genişliğe küçültülüp public/medya/eserler/<id>-<n>.jpg olarak yazılır.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from PIL import Image

FOTO_SINIRI = 4
EN_KUCUK = (480, 320)          
HEDEF_GENISLIK = 1280
CIKIS = "public/medya/eserler"
GORUNTU = re.compile(r'<image top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)" src="([^"]+)"')
SAYFA = re.compile(r'<page number="(\d+)"[^>]*width="(\d+)"')


def goruntuler(pdf, klasor):
    """(pdf_sayfa, taraf, tam_acilim, dosya, alan) listesi."""
    subprocess.run(["pdftohtml", "-xml", "-q", pdf, os.path.join(klasor, "c")], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    xml = open(os.path.join(klasor, "c.xml"), encoding="utf-8", errors="replace").read()
    sonuc = []
    for parca in xml.split("<page ")[1:]:
        m = SAYFA.search("<page " + parca)
        no, genislik = int(m.group(1)), int(m.group(2))
        for top, left, w, h, src in GORUNTU.findall(parca):
            w, h, left = int(w), int(h), int(left)
            orta = left + w / 2
            sonuc.append((no, 0 if orta < genislik / 2 else 1, w > genislik * 0.85, os.path.join(klasor, os.path.basename(src)), w * h))
    return sonuc


def main(ham_yolu, pdfler):
    ham = json.load(open(ham_yolu, encoding="utf-8"))
    os.makedirs(CIKIS, exist_ok=True)
    harita = {}
    for pdf in pdfler:
        cilt = int(re.search(r"cilt-(\d+)", pdf).group(1))
        baslangic = sorted(((e["kitap_yeri"]["pdf_sayfa"], e["kitap_yeri"]["taraf"]), e["id"])
                           for e in ham if e.get("kitap_yeri", {}).get("cilt") == cilt)
        if not baslangic:
            continue
        adaylar = {}
        with tempfile.TemporaryDirectory() as klasor:
            for no, taraf, tam, dosya, alan in goruntuler(pdf, klasor):
                try:
                    im = Image.open(dosya)
                except OSError:
                    continue
                if im.width < EN_KUCUK[0] or im.height < EN_KUCUK[1] or im.width / im.height > 3.2 or im.height / im.width > 2.5:
                    continue
                yer = (no, taraf)
                if tam:  
                    sahip = next((i for y, i in baslangic if y >= (no, 0)), None)
                else:
                    onceki = [i for y, i in baslangic if y <= yer]
                    sahip = onceki[-1] if onceki else None
                if not sahip:
                    continue
                adaylar.setdefault(sahip, []).append((no, taraf, alan, im.convert("RGB")))
            for sahip, liste in adaylar.items():
                liste.sort(key=lambda x: (x[0], x[1]))
                en_buyuk = max(liste, key=lambda x: x[2])
                secilen = [en_buyuk] + [x for x in liste if x is not en_buyuk][: FOTO_SINIRI - 1]
                yollar = []
                for n, (_, _, _, im) in enumerate(secilen, 1):
                    if im.width > HEDEF_GENISLIK:
                        im = im.resize((HEDEF_GENISLIK, round(im.height * HEDEF_GENISLIK / im.width)), Image.LANCZOS)
                    ad = f"{sahip}-{n}.jpg"
                    im.save(os.path.join(CIKIS, ad), "JPEG", quality=76, optimize=True, progressive=True)
                    yollar.append(f"/medya/eserler/{ad}")
                harita[sahip] = yollar
        print(f"cilt {cilt}: {sum(len(v) for k, v in harita.items())} fotoğraf (toplam)", file=sys.stderr)
    print(json.dumps(harita, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
