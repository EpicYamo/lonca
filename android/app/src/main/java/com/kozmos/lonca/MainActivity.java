package com.kozmos.lonca;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LoncaSunucuPlugin.class);
        registerPlugin(LoncaSesPlugin.class);
        super.onCreate(savedInstanceState);
        // Pakette olmayan medyayı (Studio'da yeni üretilen dalış görselleri, yüklenen fotoğraflar) canlı sunucudan getirir.
        bridge.setWebViewClient(new LoncaWebViewClient(bridge));
    }
}
