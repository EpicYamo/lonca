package com.kozmos.lonca;

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
}
