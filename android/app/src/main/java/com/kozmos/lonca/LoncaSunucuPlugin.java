package com.kozmos.lonca;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

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

    /** Telefonun kendi yerel ağ (IPv4) adresleri: JS tarafı sunucu ararken bu ağları tarar. İzin gerektirmez. */
    @PluginMethod
    public void agBilgisi(PluginCall call) {
        JSArray ipler = new JSArray();
        try {
            for (NetworkInterface ag : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ag.isUp() || ag.isLoopback()) continue;
                for (InetAddress a : Collections.list(ag.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) ipler.put(a.getHostAddress());
                }
            }
        } catch (Exception e) {
            // Adres okunamazsa boş liste döner; tarama yalnızca gömülü/son adreslerle sürer.
        }
        JSObject r = new JSObject();
        r.put("ipler", ipler);
        call.resolve(r);
    }
}
