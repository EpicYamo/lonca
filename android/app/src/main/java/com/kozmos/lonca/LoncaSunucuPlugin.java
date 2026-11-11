package com.kozmos.lonca;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS tarafının bulduğu Lonca sunucusunu native medya vekiline bildirir. */
@CapacitorPlugin(name = "LoncaSunucu")
public class LoncaSunucuPlugin extends Plugin {
    static volatile String adres = null;   // ör. http://192.168.1.20:3000
    static volatile String anahtar = null; // isteğe bağlı API anahtarı

    @PluginMethod
    public void ayarla(PluginCall call) {
        String a = call.getString("adres", "");
        adres = (a == null || a.isEmpty()) ? null : a.replaceAll("/+$", "");
        String k = call.getString("anahtar", "");
        anahtar = (k == null || k.isEmpty()) ? null : k;
        call.resolve();
    }

    @PluginMethod
    public void durum(PluginCall call) {
        JSObject r = new JSObject();
        r.put("adres", adres);
        call.resolve(r);
    }

    /** Lonca'nın sistem ayarları sayfasını (İzinler) ya da tur=konum ise cihazın konum servisi ayarını açar. */
    @PluginMethod
    public void ayarlariAc(PluginCall call) {
        Intent i = "konum".equals(call.getString("tur", "uygulama"))
            ? new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Ayarlar açılamadı", e);
        }
    }
}
