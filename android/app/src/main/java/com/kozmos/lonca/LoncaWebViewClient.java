package com.kozmos.lonca;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Uygulama https://localhost'tan (paketten) çalışır. Canlı sunucu bulunduysa:
 *  - /medya/... : önce paket; pakette yoksa sunucudan (yeni dalışlar, yüklenen fotoğraflar),
 *  - /sdk/...   : önce sunucu (Studio'daki modüller en güncel SDK ile çalışsın), olmazsa paket.
 * Böylece kaynak hep aynı kökenden gelir: tuval (canvas) kirlenmez, karışık içerik sorunu olmaz.
 */
public class LoncaWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;
    private final Map<String, Boolean> paketteVar = new ConcurrentHashMap<>();

    public LoncaWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String sunucu = LoncaSunucuPlugin.adres;
        Uri u = request.getUrl();
        String yol = u.getPath();
        if (sunucu != null && yol != null && "GET".equalsIgnoreCase(request.getMethod()) && "localhost".equals(u.getHost())) {
            if (yol.startsWith("/sdk/")) {
                WebResourceResponse r = vekil(sunucu, u, 2500);
                if (r != null) return r;
            } else if (yol.startsWith("/medya/") && !pakette(yol)) {
                WebResourceResponse r = vekil(sunucu, u, 6000);
                if (r != null) return r;
            }
        }
        return super.shouldInterceptRequest(view, request);
    }

    private boolean pakette(String yol) {
        return paketteVar.computeIfAbsent(yol, (p) -> {
            try (InputStream s = bridge.getContext().getAssets().open("public" + p)) {
                return true;
            } catch (Exception e) {
                return false;
            }
        });
    }

    private WebResourceResponse vekil(String sunucu, Uri u, int zamanAsimi) {
        try {
            String hedef = sunucu + u.getEncodedPath() + (u.getEncodedQuery() != null ? "?" + u.getEncodedQuery() : "");
            HttpURLConnection c = (HttpURLConnection) new URL(hedef).openConnection();
            c.setConnectTimeout(zamanAsimi);
            c.setReadTimeout(20000);
            String anahtar = LoncaSunucuPlugin.anahtar;
            if (anahtar != null) c.setRequestProperty("x-lonca-anahtar", anahtar);
            int kod = c.getResponseCode();
            if (kod != 200) {
                c.disconnect();
                return null;
            }
            String tur = c.getContentType() != null ? c.getContentType() : "application/octet-stream";
            String mime = tur.split(";")[0].trim();
            String kodlama = tur.toLowerCase().contains("charset=") ? tur.substring(tur.toLowerCase().indexOf("charset=") + 8).trim() : null;
            Map<String, String> basliklar = new HashMap<>();
            basliklar.put("Cache-Control", "no-cache");
            for (Map.Entry<String, List<String>> b : c.getHeaderFields().entrySet()) {
                if (b.getKey() != null && b.getKey().equalsIgnoreCase("content-length") && !b.getValue().isEmpty()) basliklar.put("Content-Length", b.getValue().get(0));
            }
            return new WebResourceResponse(mime, kodlama, kod, "OK", basliklar, c.getInputStream());
        } catch (Exception e) {
            return null;
        }
    }
}
