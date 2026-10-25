#!/usr/bin/env python3
"""Vakıf Eserleri Envanteri (Bursa) PDF ciltlerinden eser verisi çıkarır.

Kullanım:  python3 araclar/kitap-ice-aktar.py kitaplar/bursa-envanteri-cilt-*.pdf > data/bursa-ham.json

Kitabın yapısı: her PDF sayfası iki kitap sayfasından oluşan bir açılımdır. Her yarıda
üstte ilçe, eser adı (TR) ve İNGİLİZCE ADI; altta solda Türkçe, sağda İngilizce sütun bulunur.
Bir yarıda başlık yoksa önceki eserin devamıdır. Metin pdftotext -bbox-layout ile konumlarıyla okunur.
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from collections import Counter

BLOK = re.compile(r'<block xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</block>', re.S)
KELIME = re.compile(r"<word[^>]*>(.*?)</word>")
SAYFA = re.compile(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', re.S)


def bloklar(pdf):
    with tempfile.NamedTemporaryFile(suffix=".html") as f:
        subprocess.run(["pdftotext", "-bbox-layout", pdf, f.name], check=True)
        icerik = open(f.name, encoding="utf-8").read()
    for no, (g, y, govde) in enumerate(SAYFA.findall(icerik), 1):
        liste = []
        for m in BLOK.finditer(govde):
            x0, y0, x1, y1 = map(float, m.groups()[:4])
            metin = html.unescape(" ".join(KELIME.findall(m.group(5)))).strip()
            if metin:
                liste.append((x0, y0, x1, y1, metin))
        yield no, float(g), liste


def tirelemeyi_birlestir(t):
    return re.sub(r"(\w)- (\w)", r"\1\2", t)


def yuzde_duzeltici(tum_metin):
    sayac = Counter(re.findall(r"\w+", tum_metin))
    def duzelt(m):
        k = m.group(0)
        adaylar = [k.replace("%", h, 1) for h in ("Ş", "İ", "ş", "i")]
        return max(adaylar, key=lambda a: sayac.get(a, 0) + sayac.get(a.lower(), 0))
    return lambda t: re.sub(r"%\w*", duzelt, t)


TURLER = [
    (r"\b(Camii|Cami|Ulucami)\b", "cami"), (r"\bMescidi?\b", "mescit"), (r"\bMedresesi\b", "medrese"),
    (r"\b(Hamamı|Hamam)\b", "hamam"), (r"\b(Hanı|Han)\b", "han"), (r"\bKervansaray", "han"), (r"\bKaplıcası\b", "hamam"),
    (r"\b(Çeşmesi|Çeşme)\b", "cesme"), (r"\bSebili\b", "cesme"), (r"\b(Türbesi|Türbe)\b", "turbe"), (r"\bKümbeti\b", "turbe"),
    (r"\bİmareti\b", "imaret"), (r"\bKöprüsü\b", "kopru"), (r"\b(Tekkesi|Zaviyesi|Dergâhı|Dergahı)\b", "tekke"),
    (r"\bHaziresi\b", "hazire"), (r"\bBedesteni?\b", "carsi"), (r"\b(Çarşısı|Arastası)\b", "carsi"),
    (r"\bKülliyesi\b", "kulliye"), (r"\b(Kütüphanesi|Kitaplığı)\b", "kutuphane"), (r"\b(Evi|Konağı|Köşkü)\b", "sivil"),
]


def tur_bul(ad):
    for desen, tur in TURLER:
        if re.search(desen, ad):
            return tur
    return "diger"


ROMA = {"XII": 12, "XIII": 13, "XIV": 14, "XV": 15, "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19, "XX": 20}


def yuzyil_bul(tr):
    """Önce yapım bağlamındaki yılı, yoksa Roma rakamlı yüzyılı, yoksa ilk yılı kullanır."""
    adaylar = []
    for cumle in re.split(r"(?<=[.!?])\s+", tr):
        if re.search(r"inşa|yaptır|yapıl|kurul|bina ettir|tarihl", cumle) and not re.search(r"onar|tamir|yeniden|restor|yenilen|ihya|elden geçir|yıkıl|yandı|yangın", cumle):
            adaylar += [int(y) for y in re.findall(r"\b(1[2-9]\d\d)\b", cumle)]
            roma = re.search(r"\b(XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\. ?(yüzyıl|asır)", cumle)
            if roma and not adaylar:
                return ROMA[roma.group(1)], None
    if adaylar:
        yil = min(adaylar)
        return (yil - 1) // 100 + 1, yil
    return None, None


ADRES_SONU = re.compile(r"[’'`]?\s*(?:[dt][ae]|n?[dt][ae])?\s+(?:yer almaktadır|bulunmaktadır|yer alır|bulunur)\.?$")


def adres_bul(ad, tr_paragraflar):
    if not tr_paragraflar:
        return None
    ilk = re.split(r"(?<=[.])\s+(?=[A-ZÇĞİÖŞÜ])", tr_paragraflar[0])[0]
    if not re.search(r"yer almaktadır|bulunmaktadır|yer alır|bulunur", ilk):
        return None
    adres = ilk
    if adres.lower().startswith(ad.lower()):
        adres = adres[len(ad):]
    ilce_bas = re.search(r"(Osmangazi|Yıldırım|Nilüfer|Mudanya|Gemlik|İznik|Karacabey|İnegöl|Mustafakemalpaşa|Orhangazi|Kestel|Gürsu|Yenişehir|Keles|Orhaneli|Büyükorhan|Harmancık)\s+(?:ilçesi|İlçesi)", adres)
    if ilce_bas:
        adres = adres[ilce_bas.start():]
    adres = re.sub(r"\s+adres(?:inde|i)\b.*$", "", adres)
    adres = ADRES_SONU.sub("", adres.strip(" ,"))
    adres = re.sub(r"[’'](?:[dt][ae]|n?[dt][ae])$", "", adres).strip(" ,")
    return adres if 8 <= len(adres) <= 160 else None


def tr_baslik(metin):
    """Türkçe büyük harf kurallarıyla baş harfi büyük yazım: "OSMANGAZİ" → "Osmangazi"."""
    def kelime(k):
        alt = k.replace("I", "ı").replace("İ", "i").lower()
        return alt[:1].replace("i", "İ").replace("ı", "I").upper() + alt[1:] if alt else alt
    return " ".join(kelime(k) for k in metin.split())


def katla(k):
    tablo = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛ", "cgiosuaiuCGIOSUAIU")
    return re.sub(r"\W", "", k.translate(tablo).lower())


def ingilizce_ad(en, tr_ad):
    """Büyük harfli İngilizce başlığı düzgün yazar; Türkçe özel adları TR başlıktan alır (ALACAHIRKA → Alacahırka)."""
    tr_kelimeler = {katla(k): k for k in re.findall(r"[\w’'.()-]+", tr_ad)}
    sonuc = []
    for k in en.split():
        sonuc.append(tr_kelimeler.get(katla(k)) or k[:1] + k[1:].lower())
    return " ".join(sonuc)


EN_TUR = re.compile(r"(MOSQUE|MASJID|TOMB|BATH|INN|FOUNTAIN|MADRASA|COMPLEX|IMARET|BRIDGE|LODGE|GRAVEYARD|BAZAAR|"
                    r"BEDESTEN|LIBRARY|SHRINE|MAUSOLEUM|CARAVANSERAI|HOUSE|MANSION|SCHOOL|ZAWIYA|TEKKE|PRAYER|"
                    r"SHADIRVAN|SEBIL|CEMETERY|MARKET|KHAN|HAN|AREA|BUILDING|SPRING|CISTERN|AQUEDUCT|DERVISH|MEKTEB|SIBYAN|"
                    r"THEATER|HALL|CHURCH|GRAVE|WALLS|MAHFEL|"
                    r"CAM[İI]{1,2}|ULUCAM|TÜRBE|ÇEŞME|MEDRESE|HAMAM|HAZİRE|DARÜŞŞİFA|KÜLLİYE|MESCİD|İMARET|KÖPRÜ|BEDESTEN|"
                    r"MEKTEB|SIBYAN|ŞADIRVAN|KÜTÜPHANE|ZAVİYE|TEKKE|HAN[İI]|KAPLICA|SEBİL|NAMAZGÂH|NAMAZGAH|KİTABE)", re.I)
BOLUM = re.compile(r"(KURUMLARI|YAPILAR|ESERLER|BIBLIOGRAPHY|KAYNAKÇA|INTRODUCTION|GİRİŞ)\b")


def kimlik(ad):
    tablo = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛ", "cgiosuaiucgiosuaiu")
    return "bursa-" + re.sub(r"[^a-z0-9]+", "-", ad.translate(tablo).lower()).strip("-")[:56]


TR_KELIME = re.compile(r"\b(ve|bir|bu|ile|olarak|olan|için|yapı|caminin|türbe|tarafından|yılında|bulunan|yer|da|de|ise|gibi|kadar|sonra|ait|olup)\b")
EN_KELIME = re.compile(r"\b(the|and|of|is|was|with|which|by|in|on|to|built|located|that|this|it|has|are|were|from|its)\b")


def dil(metin):
    """Bir metin bloğunun dilini tahmin eder: 'tr' ya da 'en'."""
    tr = len(TR_KELIME.findall(metin.lower())) * 2 + len(re.findall(r"[ışğİŞĞ]", metin))
    en = len(EN_KELIME.findall(metin.lower())) * 2
    return "tr" if tr >= en else "en"


ILCE_DESEN = re.compile(r"(?:\w ){3,}\w")


def ciltleri_isle(pdfler):
    eserler = []
    for pdf in pdfler:
        cilt = int(re.search(r"cilt-(\d+)", pdf).group(1))
        sayfalar = list(bloklar(pdf))
        duzelt = yuzde_duzeltici(" ".join(b[4] for _, _, bl in sayfalar for b in bl))
        guncel = None      
        guncel_en = None   
        ilce = None
        for no, genislik, liste in sayfalar:
            yari = genislik / 2
            for taraf in (0, 1):
                ofset = taraf * yari
                parca = [b for b in liste if (b[0] >= ofset) == bool(taraf) and b[0] < ofset + yari]
                if not parca:
                    continue
                ust = sorted([b for b in parca if b[1] < 200], key=lambda b: b[1])
                sayfa_no = next((int(b[4]) for b in ust if re.fullmatch(r"\d{1,3}", b[4])), None)
                ilce_blok = next((b[4] for b in ust if ILCE_DESEN.fullmatch(b[4])), None)
                if ilce_blok:
                    ilce = tr_baslik(duzelt(ilce_blok.replace(" ", "")))
                if re.search(r"\b(Kaynakça|KAYNAKÇA|Bibliography|BIBLIOGRAPHY|DİZİN)\b", " ".join(b[4] for b in ust)):
                    guncel = guncel_en = None
                    continue
                aday = [b for b in ust if not re.fullmatch(r"\d{1,3}", b[4]) and not ILCE_DESEN.fullmatch(b[4])]
                kullanilan = set()

                for i, b in enumerate(aday[:-1]):
                    s2 = aday[i + 1]
                    if (not b[4].isupper() and len(b[4]) < 90 and not b[4].endswith(".") and s2[4].isupper()
                            and 0 < s2[1] - b[1] < 90 and EN_TUR.search(s2[4]) and not BOLUM.search(s2[4])):
                        guncel = {"ad": duzelt(b[4]), "ad_en": ingilizce_ad(s2[4], duzelt(b[4])), "ilce": ilce,
                                  "cilt": cilt, "sayfa": sayfa_no, "pdf_sayfa": no, "taraf": taraf, "tr": [], "en": []}
                        eserler.append(guncel)
                        guncel_en = guncel
                        kullanilan |= {id(b), id(s2)}
                        break

                govde = sorted([b for b in parca if id(b) not in kullanilan and not re.fullmatch(r"\d{1,3}", b[4])
                                and not ILCE_DESEN.fullmatch(b[4])],
                               key=lambda b: (round((b[0] - ofset) / (yari * 0.45)), b[1]))
                for b in govde:
                    metin = b[4]
                    if (metin.isupper() and len(metin) < 80 and b[1] < 120 and not BOLUM.search(metin)
                            and EN_TUR.search(metin)):
                        if re.search(r"\b(TOMB|MOSQUE|FOUNTAIN|BATH|MADRASA|INN|COMPLEX|IMARET|LODGE|GRAVEYARD|MASJID|HOSPITAL|LIBRARY|SCHOOL|KITCHEN|SHADIRVAN)\b", metin):
                            kelimeler = {katla(k) for k in metin.split() if len(k) > 2} - {"tomb", "mosque", "fountain", "bath", "madrasa", "inn", "complex", "imaret", "the", "and"}
                            en_iyi, puan = None, 0
                            for e in eserler[-8:]:
                                ortak = len(kelimeler & {katla(k) for k in e["ad"].split()})
                                if ortak > puan:
                                    en_iyi, puan = e, ortak
                            guncel_en = en_iyi
                            if en_iyi and not en_iyi.get("ad_en"):
                                en_iyi["ad_en"] = ingilizce_ad(metin, en_iyi["ad"])
                        else:
                            ad = tr_baslik(duzelt(metin))
                            guncel = {"ad": ad, "ad_en": None, "ilce": ilce, "cilt": cilt, "sayfa": sayfa_no,
                                      "pdf_sayfa": no, "taraf": taraf, "tr": [], "en": []}
                            eserler.append(guncel)
                        continue
                    if len(metin) < 40:
                        continue
                    if dil(metin) == "tr":
                        if guncel:
                            guncel["tr"].append(tirelemeyi_birlestir(duzelt(metin)))
                    elif guncel_en:
                        guncel_en["en"].append(tirelemeyi_birlestir(metin))
    return eserler


def temizle(eserler):
    sonuc, gorulen = [], set()
    for e in eserler:
        tr = [p for p in e["tr"] if len(p) > 40]
        en = [p for p in e["en"] if len(p) > 40]
        if not tr:
            continue
        id_ = kimlik(e["ad"])
        if id_ in gorulen:
            id_ = f"{id_}-{e['cilt']}-{e['sayfa']}"
        gorulen.add(id_)
        yuzyil, yil = yuzyil_bul(" ".join(tr))
        sonuc.append({
            "id": id_, "il": "Bursa", "ilce": e["ilce"], "ad": e["ad"], "ad_en": e["ad_en"],
            "tur": tur_bul(e["ad"]), "yuzyil": yuzyil, "yil": yil,
            "adres": adres_bul(e["ad"], tr),
            "konum": None,
            "tarihce": {"tr": "\n\n".join(tr), "en": "\n\n".join(en) or None},
            "fotograflar": [], "sergi": None,
            "kaynak": f"Vakıf Katılım, Bursa Vakıf Eserleri Envanteri, Cilt {e['cilt']}" + (f", s. {e['sayfa']}" if e["sayfa"] else ""),
            "kitap_yeri": {"cilt": e["cilt"], "pdf_sayfa": e["pdf_sayfa"], "taraf": e["taraf"]},
        })
    return sonuc


if __name__ == "__main__":
    print(json.dumps(temizle(ciltleri_isle(sys.argv[1:])), ensure_ascii=False, indent=1))
