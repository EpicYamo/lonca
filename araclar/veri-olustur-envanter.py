#!/usr/bin/env python3
"""envanter-ice-aktar.py çıktısını (Konya, Hatay) uygulamanın eser kayıtlarına dönüştürür.

Kullanım:
  python3 araclar/veri-olustur-envanter.py konya-ham.json > konya-kayit.json                 # kayıtlar (kitap_yeri ile)
  python3 araclar/foto-cikar.py konya-kayit.json kitaplar/konya-*.pdf > konya-foto.json      # kitaptaki fotoğraflar
  python3 araclar/veri-olustur-envanter.py konya-ham.json konya-foto.json --ekle data/eserler.json

--ekle verilirse kayıtlar data/eserler.json'a yazılır; aynı ilin eski kayıtları yenileriyle değiştirilir,
elle girilmiş konumlar (id aynıysa) korunur.

- Tarihçe kitabın Türkçe ve İngilizce metnidir; sütun ya da sayfa sonunda bölünen paragraflar birleştirilir,
  ilk paragraflarla sınırlanır (veri-olustur.py ile aynı sınırlar).
- Yüzyıl yalnızca yapım cümlesindeki miladi yıldan ya da Roma rakamlı yüzyıldan gelir; hicrî yıllar,
  onarım/ekleme cümleleri sayılmaz. Bulunamazsa null.
- Konum kitaplarda yok: null bırakılır, sonra `npm run konum` ile aranır.
"""
import json
import re
import sys

TR_SINIR, EN_SINIR = 1600, 1700

TURLER = [
    (r"\b(Camii|Cami|Ulucami)\b", "cami"), (r"\b(Mescidi?|Mescit)\b", "mescit"), (r"\b(Medresesi|Medrese)\b", "medrese"),
    (r"\b(Darülhuffazı|Dârü’l-Huffazı)\b", "medrese"),
    (r"\b(Hamamı|Hamam)\b", "hamam"), (r"\b(Hanı|Han)\b", "han"), (r"\bKervansaray", "han"),
    (r"\b(Çeşmesi|Çeşme)\b", "cesme"), (r"\bSebili\b", "cesme"), (r"\b(Türbesi|Türbe)\b", "turbe"), (r"\bKümbeti\b", "turbe"),
    (r"\bİmareti\b", "imaret"), (r"\bKöprüsü\b", "kopru"), (r"\b(Tekkesi|Zaviyesi|Dergâhı|Dergahı|Hanikahı)\b", "tekke"),
    (r"\bHaziresi\b", "hazire"), (r"\bBedesteni?\b", "carsi"), (r"\b(Çarşısı|Arastası)\b", "carsi"),
    (r"\bKülliyesi\b", "kulliye"), (r"\b(Kütüphanesi|Kitaplığı)\b", "kutuphane"),
    (r"\b(Evi|Ev|Konağı|Konakları|Köşkü|Konut)\b", "sivil"),
]


def tur_bul(ad):
    # "X Camii ve Külliyesi" bir külliyedir
    if re.search(r"\bKülliyesi\b", ad):
        return "kulliye"
    for desen, tur in TURLER:
        if re.search(desen, ad):
            return tur
    return "diger"


def kimlik(il, ad):
    tablo = str.maketrans("çğıöşüâîûÇĞİÖŞÜÂÎÛ", "cgiosuaiucgiosuaiu")
    return il.lower() + "-" + re.sub(r"[^a-z0-9]+", "-", ad.translate(tablo).lower()).strip("-")[:56]


ROMA = {"XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15, "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19, "XX": 20}
YAPIM = re.compile(r"inşa|yaptır|yapıl|bina ettir")
# Yapım tarihi vermeyen cümleler: onarım, ekleme, taşınma, süsleme, defin, kayıt, tartışılan görüşler…
YAPIM_DEGIL = re.compile(r"onar|tamir|yeniden|restor|yenilen|ihya|elden geçir|yıkıl|yandı|yangın|eklen|ilave|taşın|"
                         r"minare|nakış|süsle|kalem işi|kütüphane|vefat|defin|defned|muharebe|kayıtlar|defter|baskı|"
                         r"kadastr|iddia|zordur|terk|kadar|göç|yerine|yerinde|öncesinde|parsel")
# Elle doğrulanmış düzeltmeler: otomatik çıkarımın yanlış cümleye dayandığı kayıtlar (id → yüzyıl ya da None)
YUZYIL_DUZELTME = {
    "konya-mevlana-turbesi-muze": 13,             # türbe Mevlâna'nın 1273'teki vefatından bir yıl sonra yaptırıldı
    "konya-dedeler-hani": 19,                     # H. 1285 / M. 1868-69
    "hatay-ahmediye-camii": 19,                   # "1842 tarihli Ahmediye Camii"; 1909 çeşme kitabesinin tarihi
    # Yıl başka bir yapıya, öncülüne, minareye ya da tartışmalı/aralıklı bir tarihlendirmeye ait: boş bırakıldı
    **dict.fromkeys([
        "konya-tahtatepen-ubeyt-haci-adil-camii", "konya-fahrunnisa-caybasi-mescit-ve-turbesi",
        "konya-hatuniye-guduk-minare-akincilar-mahmut-mescidi", "konya-meydan-i-ahmet-camii",
        "konya-ihsaniye-ulu-camii-minaresi", "konya-lutfullah-carsi-camii-minaresi", "konya-cavus-eski-merkez-cami",
        "konya-cukurkent-koyu-camii", "konya-ali-gav-zaviyesi-mahmudiye-medresesi", "konya-zivarik-han",
        "konya-seyit-mahmut-hayrani-turbesi", "konya-haci-hamza-hafiz-hatip-ali-mescidi",
        "konya-emirgazi-emrullah-gazi-turbesi", "konya-karaaga-beldesi-eski-ulu-camii",
        "konya-seyh-ulema-yusuf-aga-camii", "konya-haci-veyis-cesmesi", "konya-bagevliya-camii-cesmesi",
        "konya-deli-osman-hani", "konya-konut", "konya-rustem-pasa-sifa-hamami",
        "hatay-meydan-camii-ve-kulliyesi", "hatay-habib-i-neccar-camii-ve-kulliyesi", "hatay-seyh-ali-camii-ve-kulliyesi",
        "hatay-nakip-camii", "hatay-kaptan-pasa-camii-minaresi",
    ], None),
}


def yuzyil_bul(tr):
    """İlk yapım cümlesindeki en erken miladi yıl ya da Roma rakamlı yüzyıl; yoksa None."""
    for cumle in re.split(r"(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9“])", tr):
        if not YAPIM.search(cumle) or YAPIM_DEGIL.search(cumle):
            continue
        temiz = re.sub(r"\b(?:H\.|Hicri|Rumi)\s*\d{3,4}(?:\s*-\s*\d{1,4})?", " ", cumle)   # hicrî/rumi yıllar
        temiz = re.sub(r"\b\d{3,4}(?:\s*-\s*\d{1,4})?\s*/\s*(?=(?:M\.\s*)?\d|\d{1,2}\s+\w+\s+\d)", " ", temiz)  # 812 / 1409
        temiz = re.sub(r"\b\d{3,4}\s*\((?=\d{4}\))", " ", temiz)                               # 1215 (1800)
        temiz = re.sub(r"\b\d{3,4}\s*(?:numaralı|nolu|no\b)", " ", temiz)
        yillar = [int(y) for y in re.findall(r"(?<![\d.])(1[0-9]\d\d)(?![\d])", temiz) if int(y) <= 2026]
        if yillar:
            return (min(yillar) - 1) // 100 + 1
        roma = re.search(r"\b(XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)\. ?(yüzyıl|asır)", cumle)
        if roma:
            return ROMA[roma.group(1)]
    return None


def adres_bul(tr):
    if not tr:
        return None
    ilk = re.split(r"(?<=[.])\s+(?=[A-ZÇĞİÖŞÜ])", tr[0])[0]
    if not re.search(r"yer almaktadır|bulunmaktadır|yer alır|bulunur", ilk):
        return None
    adres = re.sub(r"^(Cami|Camii|Mescit|Mescid|Han|Hamam|Türbe|Eser|Yapı|Medrese|Kümbet|Çeşme|Külliye|Kervansaray)\b,?\s*", "", ilk)
    adres = re.sub(r"[’'`]?\s*(?:[dt][ae]|n?[dt][ae])?\s+(?:yer almaktadır|bulunmaktadır|yer alır|bulunur)\.?$", "", adres)
    adres = re.sub(r"[’'](?:[dt][ae]|n?[dt][ae])$", "", adres.strip(" ,"))
    adres = re.sub(r"\s+(?:üzerinde|içerisinde|içinde)$", "", adres).strip(" ,")
    return adres if 8 <= len(adres) <= 160 else None


def paragraflar(parcalar):
    """Sütun/sayfa sonunda bölünen paragrafları birleştirir."""
    sonuc = []
    for p in parcalar:
        if sonuc and not re.search(r"[.!?…:”\")]$", sonuc[-1]) and p[:1].islower():
            sonuc[-1] += " " + p
        else:
            sonuc.append(p)
    return [p for p in sonuc if len(p) > 40 or re.search(r"[.!?]$", p)]


def kisalt(parcalar, sinir):
    secilen, toplam = [], 0
    for p in parcalar:
        if toplam and toplam + len(p) > sinir:
            break
        secilen.append(p)
        toplam += len(p)
    return "\n\n".join(secilen) or None


def sayfa_tamamla(eserler):
    """Sayfa numarası okunamayan (tam sayfa fotoğraflı) açılımlar için aynı PDF'teki farkı kullanır."""
    farklar = {}
    for e in eserler:
        if e["sayfa"]:
            farklar.setdefault(e["pdf"], []).append(e["sayfa"] - (e["pdf_sayfa"] * 2 + e["taraf"]))
    for e in eserler:
        if not e["sayfa"] and farklar.get(e["pdf"]):
            f = sorted(farklar[e["pdf"]])
            e["sayfa"] = e["pdf_sayfa"] * 2 + e["taraf"] + f[len(f) // 2]


# Kitapta eserden önce başka bir yapıyı anlatan giriş: tarihçe bu paragraftan başlar (id → (tr deseni, en deseni))
TARIHCE_BASI = {
    "konya-sultan-alaeddin-ulu-camii": (r"^İç Kale’nin kuzeydoğu tarafında bulunan Alâeddin Camii", r"^Alâeddin Mosque, located"),
}


def bastan_kes(parcalar, desen):
    i = next((i for i, p in enumerate(parcalar) if re.search(desen, p)), 0)
    return parcalar[i:]


def kayitlar(ham, fotolar):
    il, eserler = ham["il"], ham["eserler"]
    sayfa_tamamla(eserler)
    sonuc, gorulen = [], set()
    for e in eserler:
        if not e["ad"]:
            continue
        id_ = kimlik(il, e["ad"])
        if id_ in gorulen:
            id_ = f"{id_}-{e['sayfa']}"
        tr = paragraflar(e["tr"])
        en = paragraflar(e["en"])
        if id_ in TARIHCE_BASI:
            tr, en = bastan_kes(tr, TARIHCE_BASI[id_][0]), bastan_kes(en, TARIHCE_BASI[id_][1])
        tarihce_tr = kisalt(tr, TR_SINIR)
        if not tarihce_tr or len(tarihce_tr) < 120:
            continue
        gorulen.add(id_)
        sonuc.append({
            "id": id_, "il": il, "ilce": e["ilce"], "ad": e["ad"], "ad_en": e["ad_en"], "tur": tur_bul(e["ad"]),
            "yuzyil": YUZYIL_DUZELTME[id_] if id_ in YUZYIL_DUZELTME else yuzyil_bul(" ".join(tr)),
            "adres": adres_bul(tr),
            "konum": None,
            "tarihce": {"tr": tarihce_tr, "en": kisalt(en, EN_SINIR)},
            "fotograflar": fotolar.get(id_, []),
            "sergi": None,
            "kaynak": ham["kaynak"].format(cilt=e["cilt"], sayfa=e["sayfa"]),
            "kitap_yeri": {"pdf": e["pdf"], "pdf_sayfa": e["pdf_sayfa"], "taraf": e["taraf"]},
        })
    return sonuc


NOT = ("Kaynak: Vakıf Katılım vakıf eserleri kitapları: Bursa Vakıf Eserleri Envanteri (3 cilt, 2026), "
       "Konya Vakıf Eserleri (2 cilt, 2024) ve Hatay İli Vakıf Eserleri. Metinler kitaplardan otomatik çıkarılmış ve "
       "kısaltılmıştır; fotoğraflar kitaplardan alınmıştır; konumlar elle girilmiş ya da OpenStreetMap’ten ad ve mahalle "
       "denetimiyle eşleştirilmiş yaklaşık değerlerdir. Ayrıntılar için araclar/ klasörüne bakın.")


def main(args):
    ekle = None
    if "--ekle" in args:
        i = args.index("--ekle")
        ekle = args[i + 1]
        args = args[:i] + args[i + 2:]
    ham = json.load(open(args[0], encoding="utf-8"))
    fotolar = json.load(open(args[1], encoding="utf-8")) if len(args) > 1 else {}
    yeni = kayitlar(ham, fotolar)
    if not ekle:
        print(json.dumps(yeni, ensure_ascii=False, indent=1))
        return
    veri = json.load(open(ekle, encoding="utf-8"))
    eski = {e["id"]: e for e in veri["eserler"] if e.get("il") == ham["il"]}
    for e in yeni:
        del e["kitap_yeri"]
        if eski.get(e["id"], {}).get("konum"):
            e["konum"] = eski[e["id"]]["konum"]
            if eski[e["id"]].get("konum_kaynagi"):
                e["konum_kaynagi"] = eski[e["id"]]["konum_kaynagi"]
    veri["eserler"] = [e for e in veri["eserler"] if e.get("il") != ham["il"]] + yeni
    veri["_not"] = NOT
    with open(ekle, "w", encoding="utf-8") as f:
        f.write(json.dumps(veri, ensure_ascii=False, indent=1) + "\n")
    print(f"{ham['il']}: {len(yeni)} eser yazıldı → {ekle}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1:])
