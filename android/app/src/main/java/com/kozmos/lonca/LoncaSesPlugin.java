package com.kozmos.lonca;

import android.content.Intent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Sesli okuma. Android WebView'da speechSynthesis olmadığı için metni telefonun metin okuma motoruna verir.
 * Varsayılan motor istenen dili bilmiyorsa (ör. Samsung TTS'te Türkçe yok) telefonda kurulu öteki motorları
 * (ör. Google Konuşma Hizmetleri) dener; dili bilen ilk motor o dil için kullanılır.
 */
@CapacitorPlugin(name = "LoncaSes")
public class LoncaSesPlugin extends Plugin {

    /** Bir TTS motoru; hazır olana kadar gelen işler sırada bekler. */
    private class Motor {
        final String paket;
        TextToSpeech tts;
        Boolean hazir = null; // null: açılıyor, true: hazır, false: açılamadı
        final List<Runnable> bekleyen = new ArrayList<>();

        Motor(String paket) {
            this.paket = paket;
            tts = new TextToSpeech(getContext(), (durum) -> {
                synchronized (Motor.this) {
                    hazir = durum == TextToSpeech.SUCCESS;
                }
                if (hazir) tts.setOnUtteranceProgressListener(dinleyici);
                List<Runnable> isler;
                synchronized (Motor.this) {
                    isler = new ArrayList<>(bekleyen);
                    bekleyen.clear();
                }
                for (Runnable r : isler) r.run();
            }, paket.isEmpty() ? null : paket);
        }

        void hazirken(Runnable is) {
            synchronized (this) {
                if (hazir == null) { bekleyen.add(is); return; }
            }
            is.run();
        }
    }

    private final Map<String, Motor> motorlar = new HashMap<>();
    private final Map<String, String> dilMotoru = new HashMap<>(); // "tr-TR" → motor paketi ("" = yok)
    private final Map<String, PluginCall> konusmalar = new HashMap<>();

    private final UtteranceProgressListener dinleyici = new UtteranceProgressListener() {
        @Override public void onStart(String id) {}
        @Override public void onDone(String id) { bitir(id, null); }
        @Override public void onError(String id) { bitir(id, "Okuma başarısız"); }
        @Override public void onStop(String id, boolean kesildi) { bitir(id, null); }
    };

    private void bitir(String id, String hata) {
        PluginCall c;
        synchronized (konusmalar) { c = konusmalar.remove(id); }
        if (c == null) return;
        if (hata == null) c.resolve(); else c.reject(hata);
    }

    private synchronized Motor motor(String paket) {
        Motor m = motorlar.get(paket);
        if (m == null) { m = new Motor(paket); motorlar.put(paket, m); }
        return m;
    }

    /** Varsayılan motor önce, sonra kurulu öteki motorlar (Google en başta). */
    private List<String> motorSirasi() {
        Motor ilk = motor("");
        List<String> sira = new ArrayList<>();
        String varsayilan = ilk.tts.getDefaultEngine();
        if (varsayilan != null) sira.add(varsayilan);
        List<String> digerleri = new ArrayList<>();
        for (TextToSpeech.EngineInfo e : ilk.tts.getEngines()) {
            if (sira.contains(e.name)) continue;
            if (e.name.equals("com.google.android.tts")) digerleri.add(0, e.name); else digerleri.add(e.name);
        }
        sira.addAll(digerleri);
        return sira;
    }

    private static boolean biliyor(Motor m, Locale yer) {
        if (!Boolean.TRUE.equals(m.hazir)) return false;
        try {
            return m.tts.isLanguageAvailable(yer) >= TextToSpeech.LANG_AVAILABLE;
        } catch (Exception e) {
            return false;
        }
    }

    /** Dili bilen motoru bulur; sonuç (motor ya da null) geri çağrıyla döner. */
    private void motorBul(String dil, java.util.function.Consumer<Motor> sonuc) {
        String bilinen;
        synchronized (dilMotoru) { bilinen = dilMotoru.get(dil); }
        if (bilinen != null) {
            if (bilinen.isEmpty()) { sonuc.accept(null); return; }
            Motor m = motor(bilinen);
            m.hazirken(() -> sonuc.accept(m));
            return;
        }
        Locale yer = Locale.forLanguageTag(dil);
        // İlk motor hazır olmadan motor listesi boş gelebilir: önce onu bekle.
        motor("").hazirken(() -> dene(motorSirasi(), 0, yer, dil, sonuc));
    }

    private void dene(List<String> sira, int i, Locale yer, String dil, java.util.function.Consumer<Motor> sonuc) {
        if (i >= sira.size()) {
            synchronized (dilMotoru) { dilMotoru.put(dil, ""); }
            sonuc.accept(null);
            return;
        }
        Motor m = motor(sira.get(i));
        m.hazirken(() -> {
            if (biliyor(m, yer)) {
                synchronized (dilMotoru) { dilMotoru.put(dil, m.paket); }
                sonuc.accept(m);
            } else {
                dene(sira, i + 1, yer, dil, sonuc);
            }
        });
    }

    /** { diller: ["tr-TR", "en-US"] } → { destekli: ["tr-TR", …] } */
    @PluginMethod
    public void durum(PluginCall call) {
        JSArray istenen = call.getArray("diller", new JSArray());
        List<String> diller = new ArrayList<>();
        for (int i = 0; i < istenen.length(); i++) diller.add(istenen.optString(i));
        List<String> destekli = new ArrayList<>();
        durumSirayla(diller, 0, destekli, call);
    }

    private void durumSirayla(List<String> diller, int i, List<String> destekli, PluginCall call) {
        if (i >= diller.size()) {
            JSObject r = new JSObject();
            r.put("destekli", new JSArray(destekli));
            call.resolve(r);
            return;
        }
        String dil = diller.get(i);
        motorBul(dil, (m) -> {
            if (m != null) destekli.add(dil);
            durumSirayla(diller, i + 1, destekli, call);
        });
    }

    /** { metin, dil: "tr-TR", hiz: 1 } — okuma bitince çözülür. */
    @PluginMethod
    public void konus(PluginCall call) {
        String metin = call.getString("metin", "");
        String dil = call.getString("dil", "tr-TR");
        float hiz = call.getFloat("hiz", 1f);
        motorBul(dil, (m) -> {
            if (m == null) { call.reject("Bu dilde ses yok: " + dil, "DIL_YOK"); return; }
            durdurHepsi();
            String id = UUID.randomUUID().toString();
            synchronized (konusmalar) { konusmalar.put(id, call); }
            m.tts.setLanguage(Locale.forLanguageTag(dil));
            m.tts.setSpeechRate(Math.max(0.5f, Math.min(2f, hiz)));
            int r = m.tts.speak(metin, TextToSpeech.QUEUE_FLUSH, null, id);
            if (r != TextToSpeech.SUCCESS) bitir(id, "Okuma başlatılamadı");
        });
    }

    private void durdurHepsi() {
        List<Motor> liste;
        synchronized (this) { liste = new ArrayList<>(motorlar.values()); }
        for (Motor m : liste) if (Boolean.TRUE.equals(m.hazir)) m.tts.stop();
    }

    @PluginMethod
    public void dur(PluginCall call) {
        durdurHepsi();
        call.resolve();
    }

    /** Telefonun ses verisi kurulum ekranını açar (Türkçe ses yoksa). */
    @PluginMethod
    public void sesKur(PluginCall call) {
        Intent niyet = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
        niyet.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(niyet);
            call.resolve();
        } catch (Exception e) {
            call.reject("Ses kurulum ekranı açılamadı");
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (Motor m : motorlar.values()) {
            try { m.tts.shutdown(); } catch (Exception ignored) {}
        }
        motorlar.clear();
    }
}
