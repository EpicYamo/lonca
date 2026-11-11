#!/usr/bin/env python3
"""Vakıf Katılım'ın Konya ve Hatay vakıf eserleri kitaplarından ham eser verisi çıkarır.

Kullanım:
  python3 araclar/envanter-ice-aktar.py konya kitaplar/konya-envanteri-1_cilt-web.pdf kitaplar/konya-envanteri-2_cilt-web.pdf > konya-ham.json
  python3 araclar/envanter-ice-aktar.py hatay kitaplar/hatay-vakif-eserleri.pdf > hatay-ham.json

Bursa ciltleri için araclar/kitap-ice-aktar.py kullanılır; Konya ve Hatay kitaplarının dizgisi farklıdır.
Her PDF sayfası iki kitap sayfasından oluşan bir açılımdır. Metin pdftotext -bbox-layout ile konumlarıyla
ve sözcük yüksekliğiyle (yazı boyu) okunur:

- Konya: üstte aralıklı harflerle ilçe (yazı boyu ~29), altında eser adı (~35) ve İngilizce adı (büyük harf, ~22).
  Gövde ~14-16 boyunda; ~11 boyundaki kutular (ayet, yan bilgi) ve ~18 boyundaki alt başlıklar atlanır.
- Hatay: eser adı ~27 boyunda (Türkçe ve İngilizce iki ayrı başlık), gövde ~13 ve ~18 boyunda; ilçe başlığı yok,
  ilçe adres cümlesinden okunur.
Bir yarıda başlık yoksa önceki eserin devamıdır. Çıktı veri-olustur-envanter.py'ye verilir.
"""
import html
import json
import os
import re
import subprocess
import sys
import tempfile

BLOK = re.compile(r'<block xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</block>', re.S)
KELIME = re.compile(r'<word xMin="[\d.]+" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">(.*?)</word>')
SAYFA = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)

KITAPLAR = {
    "konya": {"il": "Konya", "kaynak": "Vakıf Katılım, Konya Vakıf Eserleri, Cilt {cilt}, s. {sayfa}"},
    "hatay": {"il": "Hatay", "kaynak": "Vakıf Katılım, Hatay İli Vakıf Eserleri, s. {sayfa}"},
}


def bloklar(pdf):
    """(pdf_sayfa, genişlik, [(x0, y0, x1, y1, metin, yazı_boyu)]) üretir."""
    with tempfile.NamedTemporaryFile(suffix=".html") as f:
        subprocess.run(["pdftotext", "-bbox-layout", pdf, f.name], check=True, stderr=subprocess.DEVNULL)
        icerik = open(f.name, encoding="utf-8").read()
    for no, (g, _, govde) in enumerate(SAYFA.findall(icerik), 1):
        liste = []
        for m in BLOK.finditer(govde):
            kelimeler = KELIME.findall(m.group(5))
            metin = html.unescape(" ".join(k[2] for k in kelimeler)).strip()
            if not metin:
                continue
            boylar = sorted(float(y1) - float(y0) for y0, y1, _ in kelimeler)
            liste.append(tuple(float(x) for x in m.groups()[:4]) + (metin, round(boylar[len(boylar) // 2])))
        yield no, float(g), liste


def tirelemeyi_birlestir(t):
    # Satır sonu tirelemesi: "bu- lunmaktadır" → "bulunmaktadır" (yalnızca küçük harften önce)
    return re.sub(r"(\w)- (?=[a-zçğıöşüâîû])", r"\1", t)


def bosluk(t):
    return re.sub(r"\s+", " ", t.replace("\t", " ")).strip()


TR_KELIME = re.compile(r"\b(ve|bir|bu|ile|olarak|olan|için|yapı|caminin|türbe|tarafından|yılında|bulunan|yer|da|de|ise|gibi|kadar|sonra|ait|olup|mescit|cami)\b")
EN_KELIME = re.compile(r"\b(the|and|of|is|was|with|which|by|in|on|to|built|located|that|this|it|has|are|were|from|its)\b")


def dil(metin):
    kucuk = metin.lower()
    tr = len(TR_KELIME.findall(kucuk)) * 2 + len(re.findall(r"[ışğİŞĞ]", metin))
    en = len(EN_KELIME.findall(kucuk)) * 2
    return "tr" if tr >= en else "en"


KUCUK_KALAN = {"ve", "and", "of", "the"}


def tr_baslik(metin):
    """Türkçe büyük harf kurallarıyla: "AFFAN (ERTUĞRUL) CAMİİ VE KÜLLİYESİ" → "Affan (Ertuğrul) Camii ve Külliyesi"."""
    def parca(k):
        alt = k.replace("I", "ı").replace("İ", "i").lower()
        return alt[:1].replace("i", "İ").replace("ı", "I").upper() + alt[1:] if alt else alt

    def kelime(k, ilk):
        if not ilk and k.replace("I", "ı").replace("İ", "i").lower() in KUCUK_KALAN:
            return k.replace("I", "ı").replace("İ", "i").lower()
        return re.sub(r"[^\W\d_][\w’'.]*", lambda m: parca(m.group(0)), k)
    sonuc = " ".join(kelime(k, i == 0) for i, k in enumerate(metin.split()))
    return re.sub(r"-([İI])\b", lambda m: "-" + ("i" if m.group(1) == "İ" else "ı"), sonuc)   # Habib-i, Beyazıd-ı


def katla(k):
    return re.sub(r"\W", "", k.translate(str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛ", "cgiosuaiuCGIOSUAIU")).lower())


def ingilizce_ad(en, tr_ad=None):
    """İngilizce başlığı düzgün yazar; Türkçe özel adları Türkçe başlıktan alır (KIRCAOĞLU MOUND → Kırcaoğlu Mound)."""
    if not en:
        return None
    tr = {katla(k): k for k in re.findall(r"[^\W\d_][\w’'.]*", tr_baslik(tr_ad) if tr_ad else "")}
    def parca(k):
        return tr.get(katla(k)) or (k[:1] + k[1:].replace("İ", "i").lower())
    def kelime(k, ilk):
        if not ilk and k.lower() in KUCUK_KALAN:
            return k.lower()
        return re.sub(r"[^\W\d_][\w’'.]*", lambda m: parca(m.group(0)), k)
    return " ".join(kelime(k, i == 0) for i, k in enumerate(bosluk(en).split()))


# ---------------------------------------------------------------- Konya

def konya(pdfler):
    eserler = []
    for pdf in pdfler:
        cilt = int(re.search(r"(\d)_cilt", os.path.basename(pdf)).group(1))
        guncel, ilce, bitti = None, None, False
        for no, genislik, liste in bloklar(pdf):
            if bitti:
                break
            # Bölüm kapakları (yazı boyu ~61): "Camiler", "Türbeler"…; "Değerlendirme", "Kaynakça" bitiştir.
            for b in liste:
                if b[5] >= 55 and re.search(r"Değerlendirme|Kaynakça", b[4]):
                    bitti = True
            if bitti:
                break
            if any(b[5] >= 55 for b in liste):
                guncel = None
                continue
            yari = genislik / 2
            for taraf in (0, 1):
                parca = [b for b in liste if (b[0] >= yari) == bool(taraf)]
                if not parca:
                    continue
                sayfa_no = next((int(b[4]) for b in parca if b[1] < 75 and re.fullmatch(r"\d{1,3}", b[4])), None)
                harfler = sorted([b for b in parca if 27 <= b[5] <= 31 and b[1] < 130], key=lambda b: b[0])
                if harfler:
                    ilce = tr_baslik("".join(b[4] for b in harfler).replace(" ", ""))
                baslik = next((b for b in parca if 33 <= b[5] <= 37 and b[1] < 200), None)
                onceki = guncel
                if baslik:
                    en_baslik = next((b for b in sorted(parca, key=lambda b: b[1])
                                      if 19 <= b[5] <= 23 and b[4].isupper() and 0 < b[1] - baslik[1] < 70), None)
                    guncel = {"ad": bosluk(baslik[4]).replace("( ", "(").replace(" )", ")"),
                              "ad_en": ingilizce_ad(en_baslik[4], baslik[4]) if en_baslik else None,
                              "ilce": ilce, "cilt": cilt, "sayfa": sayfa_no, "pdf": os.path.basename(pdf),
                              "pdf_sayfa": no, "taraf": taraf, "tr": [], "en": []}
                    eserler.append(guncel)
                govde = [b for b in parca if 13 <= b[5] <= 16 and len(b[4]) >= 25]
                # Okuma sırası: sütun (x), sonra satır (y)
                govde.sort(key=lambda b: (round(b[0] / 40), b[1]))
                for b in govde:
                    hedef = guncel
                    # Başlıktan solda kalan sütunlar önceki eserin devamıdır (başlık sayfanın sağ sütunundaysa).
                    if baslik and onceki and b[2] < baslik[0] - 20:
                        hedef = onceki
                    if not hedef:
                        continue
                    metin = tirelemeyi_birlestir(bosluk(b[4]))
                    hedef["tr" if dil(metin) == "tr" else "en"].append(metin)
    return eserler


# ---------------------------------------------------------------- Hatay

HATAY_BOLUMLER = re.compile(r"KÜLLİYELER VE|CAMİLER VE MESCİTLER|TÜRBELER / ZİYARETLER|KİLİSELER|İŞ YERİ VE DİĞERLERİ|"
                            r"WORKPLACE AND OTHERS|ESKİ EVLER VE KONAKLAR|COMPLEXES AND|MOSQUES AND MASJIDS|TOMBS / VISITS|OLD HOUSES")
HATAY_ILCELER = ["Antakya", "İskenderun", "Samandağ", "Reyhanlı", "Kırıkhan", "Dörtyol", "Payas", "Belen", "Altınözü",
                 "Defne", "Arsuz", "Hassa", "Erzin", "Yayladağı", "Kumlu"]
HATAY_KULLIYE_SONU = 97   # 97. PDF sayfasından sonra "Camiler ve Mescitler" bölümü başlar


def hatay_ilce(tr):
    """İlçe adı adres cümlesinden okunur (kitapta ilçe başlığı yok)."""
    bas = " ".join(tr)[:400]
    konumlar = [(bas.find(i), i) for i in HATAY_ILCELER if i in bas]
    if not konumlar:
        return None
    ilce = min(konumlar)[1]
    return "Dörtyol" if ilce == "Payas" else ilce


def hatay(pdfler):
    eserler = []
    for pdf in pdfler:
        guncel = None
        for no, genislik, liste in bloklar(pdf):
            if no < 26:                       # takdim, giriş, Hatay tarihi
                continue
            yari = genislik / 2
            sayfa_no = {t: next((int(b[4]) for b in liste if b[1] > 800 and (b[0] >= yari) == bool(t)
                                 and re.fullmatch(r"\d{1,3}", b[4])), None) for t in (0, 1)}
            # Külliye başlıkları yatay ve büyük (~69); diğer eserlerin başlıkları sayfanın solunda dikey yazılı.
            if no < HATAY_KULLIYE_SONU:
                buyuk = [b for b in liste if b[5] >= 60 and b[2] - b[0] > b[3] - b[1] and not HATAY_BOLUMLER.search(b[4])]
                if buyuk:
                    metin = bosluk(" ".join(b[4] for b in sorted(buyuk, key=lambda b: b[1])))
                    m = re.match(r"(.*?(?:KÜLLİYESİ|KERVANSARAYI))\s+(.*)$", metin)
                    tr_ad, en_ad = (m.group(1), m.group(2)) if m else (metin, None)
                    taraf = int(buyuk[0][0] >= yari)
                    guncel = {"ad": tr_baslik(tr_ad), "ad_en": ingilizce_ad(en_ad, tr_ad), "ilce": None, "cilt": None,
                              "sayfa": sayfa_no[taraf], "pdf": os.path.basename(pdf), "pdf_sayfa": no, "taraf": taraf,
                              "tr": [], "en": []}
                    eserler.append(guncel)
            else:
                # Dikey başlık: dar ve uzun blok; solda Türkçe, sağında İngilizce. Bazen ikisi tek blokta.
                dikey = [b for b in liste if 35 <= b[2] - b[0] < 240 and b[3] - b[1] > 1.8 * (b[2] - b[0])]
                for taraf in (0, 1):
                    yan = sorted([b for b in dikey if (b[0] >= yari) == bool(taraf) and b[0] - taraf * yari < 210],
                                 key=lambda b: b[0])
                    tr_b = yan[0] if yan and yan[0][0] - taraf * yari < 60 else None
                    en_b = next((b for b in yan if b is not tr_b), None)
                    tr_ad, en_ad = (bosluk(tr_b[4]) if tr_b else None), (bosluk(en_b[4]) if en_b else None)
                    if tr_ad and not en_ad:
                        m = re.match(r"(.*?\b(?:TÜRBESİ|MAKAMI|ZİYARETİ|CAMİİ|MESCİDİ|KİLİSESİ|HAMAMI|HANI?))\s+(.+)$", tr_ad)
                        if m:
                            tr_ad, en_ad = m.group(1), m.group(2)
                    if tr_ad:
                        tr_ad = re.sub(r"MINTIKA(?=\d)", "MINTIKA ", tr_ad)
                    if tr_ad and HATAY_BOLUMLER.search(tr_ad):
                        guncel = None
                        continue
                    if not tr_ad and not en_ad:
                        continue
                    guncel = {"ad": tr_baslik(tr_ad) if tr_ad else None, "ad_en": ingilizce_ad(en_ad, tr_ad),
                              "ilce": None, "cilt": None, "sayfa": sayfa_no[taraf], "pdf": os.path.basename(pdf),
                              "pdf_sayfa": no, "taraf": taraf, "tr": [], "en": []}
                    eserler.append(guncel)
            if not guncel:
                continue
            govde = [b for b in liste if 17 <= b[5] <= 20 and len(b[4]) >= 25 and b[2] - b[0] > 75]
            govde.sort(key=lambda b: (round(b[0] / 40), b[1]))
            for b in govde:
                metin = tirelemeyi_birlestir(bosluk(b[4]))
                guncel["tr" if dil(metin) == "tr" else "en"].append(metin)
    for e in eserler:
        e["ilce"] = hatay_ilce(e["tr"])
    return eserler


if __name__ == "__main__":
    kitap = sys.argv[1]
    eserler = {"konya": konya, "hatay": hatay}[kitap](sys.argv[2:])
    print(json.dumps({"kitap": kitap, **KITAPLAR[kitap], "eserler": eserler}, ensure_ascii=False, indent=1))
