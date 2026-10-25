#!/usr/bin/env python3
"""Kitaptan çıkarılan ham veriyi (kitap-ice-aktar.py çıktısı) uygulamanın eser verisine dönüştürür.

Kullanım:  python3 araclar/veri-olustur.py ham.json data/bursa-ek.json data/bursa-fotograflar.json > data/eserler.json

- Tarihçe, eserin kendi başlangıcından itibaren ilk paragraflarla sınırlanır (külliye bölümlerinde
  metin sonraki yapılara taşabildiği için); sonuna kitaptaki yerinin bilgisi eklenir.
- Elle girilen yaklaşık konumlar ve yüzyıl düzeltmeleri bursa-ek.json'dan uygulanır.
- Kitaplardan çıkarılan gerçek fotoğraflar bursa-fotograflar.json'dan (araclar/foto-cikar.py) eklenir.
"""
import json
import re
import sys

TR_SINIR, EN_SINIR = 1600, 1700
YAZIM = {"Emır": "Emir"}


def yazim(metin):
    if not metin:
        return metin
    for yanlis, dogru in YAZIM.items():
        metin = re.sub(rf"\b{yanlis}", dogru, metin)
    return metin


def kisalt(metin, sinir):
    if not metin:
        return None
    paragraflar, toplam = [], 0
    for p in metin.split("\n\n"):
        if toplam and toplam + len(p) > sinir:
            break
        paragraflar.append(p)
        toplam += len(p)
    return "\n\n".join(paragraflar)


def main(ham_yolu, ek_yolu, foto_yolu=None):
    ham = json.load(open(ham_yolu, encoding="utf-8"))
    ek = json.load(open(ek_yolu, encoding="utf-8"))["eserler"]
    fotolar = json.load(open(foto_yolu, encoding="utf-8")) if foto_yolu else {}
    eserler = []
    for e in ham:
        if e["tur"] == "diger" and not e["adres"]:
            continue
        duzeltme = ek.get(e["ad"], {})
        tr = kisalt(e["tarihce"]["tr"], TR_SINIR)
        en = kisalt(e["tarihce"]["en"], EN_SINIR)
        if not tr or len(tr) < 120:
            continue
        konum = duzeltme.get("konum")
        eserler.append({
            "id": e["id"], "il": "Bursa", "ilce": e["ilce"], "ad": yazim(e["ad"]), "ad_en": e["ad_en"], "tur": e["tur"],
            "yuzyil": duzeltme["yuzyil"] if "yuzyil" in duzeltme else e["yuzyil"],
            "adres": e["adres"],
            "konum": {"lat": konum[0], "lng": konum[1], "yaklasik": True} if konum else None,
            "tarihce": {"tr": yazim(tr), "en": en},
            "fotograflar": duzeltme.get("fotograflar") or fotolar.get(e["id"], []),
            "sergi": None,
            "kaynak": e["kaynak"],
        })
    print(json.dumps({
        "_not": "Kaynak: Vakıf Katılım, Bursa Vakıf Eserleri Envanteri (3 cilt, 2026). Metinler kitaptan otomatik çıkarılmış ve kısaltılmıştır; "
                "fotoğraflar kitaplardan alınmıştır; konumlar elle girilmiş yaklaşık değerlerdir. Ayrıntılar için araclar/ klasörüne bakın.",
        "eserler": eserler,
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(*sys.argv[1:4])
