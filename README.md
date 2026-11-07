# Lonca

An AI-assisted mini-app platform for foundation heritage sites.
**KÖK&KOD Hackathon — Team Kozmos.**

> **You are the master. The AI is your journeyman.**

**Lonca** (`/app/`) is the citizen-facing app. It lists published modules like an
app store; opening one hands the whole screen to that module, which behaves like
a standalone app or game.

**Lonca Studio** (`/studio/`) is where anyone with an idea — the master — talks
to an AI journeyman. The journeyman writes and audits the module, the module runs
in a live preview, and it is submitted for approval. Editors publish, unpublish
and archive modules, and manage the heritage content behind them.

The point is not to generate code for its own sake: the platform makes a
heritage catalogue *playable*. Modules can only read verified data through the
SDK, so a generated app cannot invent history.

## Contents

- [Setup](#setup)
- [Commands](#commands)
- [Architecture](#architecture)
- [A module is an independent mini app](#a-module-is-an-independent-mini-app)
- [The AI journeyman](#the-ai-journeyman)
- [Data](#data)
- [Data pipeline](#data-pipeline)
- [Content management and moderation](#content-management-and-moderation)
- [Security](#security)
- [Real 3D](#real-3d)
- [Folders](#folders)
- [Licenses](#licenses)

## Setup

Requires Node.js 20.19 or newer.

```bash
npm install
cp .env.example .env     # optional: journeyman, admin password, Google key
npm run dev              # http://localhost:3000/app  ·  Studio: http://localhost:3000/studio
```

Everything works without any configuration:

- The journeyman answers from built-in templates ("fake mode").
- The map uses dark-filtered OpenStreetMap tiles.
- Real 3D is disabled, and modules hide the 3D button.
- Admin actions are open (development mode).

| Setting (`.env`) | What it does |
| --- | --- |
| `USTAGPT_BASE_URL`, `USTAGPT_API_KEY` | Primary AI provider (UstaGPT, OpenAI-compatible) for both the module journeyman and the dive journeyman. Models are picked in Studio (Atölye → model badge or the sliders button); the choice is stored in `data/kalfa-ayarlari.json` and overrides `.env` without a restart |
| `KALFA_SAGLAYICI`, `KALFA_API_URL`, `KALFA_API_ANAHTARI`, `KALFA_MODEL` | Optional: point the module journeyman at another endpoint (OpenCode Go, Claude, offline Ollama) |
| `KALFA_SAHTE=1` | Offline fallback: the journeyman returns a prepared template |
| `YONETICI_SIFRE` | Password for publishing, removing, deleting and editing content in Studio |
| `GOOGLE_HARITA_ANAHTARI` | Google Maps and real 3D (Photorealistic 3D Tiles) |
| `KALFA_SINIR` | Journeyman requests allowed per IP in ten minutes |
| `KALFA_ZAMAN_ASIMI_SN` | Timeout for a single journeyman request to the provider (default 150 s) |
| `OTURUM_ANAHTARI` | Signs Studio account tokens; generated into `data/.oturum-anahtari` when empty |
| `HESAP_SINIR` | Sign-up / login attempts allowed per IP in ten minutes |
| `LONCA_API_ANAHTARI` | API key: when set, every `/api` request needs the `x-lonca-anahtar` header (or a paired device key / browser login) |

To try it on a phone, connect to the same Wi-Fi and open
`http://<computer-ip>:3000/app`. The app can be added to the home screen (there
is a web app manifest). Browsers only grant location permission on HTTPS or
localhost; if the phone cannot get a location, the demo location (Bursa, Hanlar
district) is used.

### Docker

The image contains Node 22, ffmpeg/ffprobe and python3 + Pillow (needed by the
dive journeyman). Keys are never baked into the image: `.env` is read at run time
through `env_file`. `data/` and `public/medya/` are mounted as volumes.

```bash
cp .env.example .env                                   # set LONCA_API_ANAHTARI (openssl rand -hex 24)
docker compose up -d --build                           # listens on 0.0.0.0:3000
docker compose exec lonca node araclar/eslestir.mjs    # 6-digit pairing code for a phone
```

**Connecting the Android app:** the app checks its fixed server with
`GET /api/merhaba` (always open, returns `{ lonca, anahtarGerekli }`). It then
either sends the main key in `x-lonca-anahtar`, or exchanges a pairing code for its own device key
with `POST /api/eslestir { kod, ad }` → `{ anahtar }`. Codes are single-use and
expire after five minutes. List or revoke devices with
`node araclar/eslestir.mjs --liste` / `--sil <id>`. In a browser, `/app/` and
`/studio/` redirect to `/giris` once; the key is exchanged for a revocable
HttpOnly cookie (`/cikis` logs out).

### Internet deployment behind Cloudflare (recommended)

`docker-compose.cloudflare.yml` runs a Cloudflare Tunnel (`cloudflared`) next to
Lonca. No port is published on the server and no certificate is needed:
Cloudflare terminates HTTPS and the tunnel connects outwards.

1. Cloudflare dashboard → Zero Trust → Networks → Tunnels → create a Cloudflared
   tunnel and copy its token. Add a public hostname: `kozmos.42.fr` → `HTTP`,
   `lonca:3000`.
2. In `.env`: `CLOUDFLARE_TUNNEL_TOKEN`, a strong `LONCA_API_ANAHTARI`,
   `YONETICI_SIFRE` and the UstaGPT key.
3. Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.cloudflare.yml up -d --build
curl https://kozmos.42.fr/api/merhaba
```

The overlay sets `LONCA_IP_BASLIGI=cf-connecting-ip` so rate limits count the
real visitor instead of the tunnel. Cloudflare waits at most 100 s for response
headers (free plan); a single request that takes longer gets a 524.

### Internet deployment (Nginx + HTTPS)

On a server with a domain, `docker-compose.sunucu.yml` puts Nginx in front of
Lonca: it terminates HTTPS with a Let's Encrypt certificate, redirects HTTP to
HTTPS and proxies `/api`, `/medya`, `/sdk`, `/app` and `/studio` to the Lonca
container, whose port 3000 is no longer published.

1. Point the domain's DNS `A` record (and `AAAA` if any) at the server's public IP.
   Open ports 80 and 443.
2. In `.env`: `LONCA_EPOSTA=…` and a strong `LONCA_API_ANAHTARI`. The domain
   defaults to the project's `kozmos.42.fr`; set `LONCA_ALAN_ADI` to use another. Optional
   `LONCA_YOL_ONEKI=/lonca` serves under
   `https://domain/lonca/` (the API works there; browser redirects of
   `/app`/`/studio` assume the root).
3. Start, then get the first certificate (once; renewal is automatic, Nginx
   reloads by itself):

```bash
docker compose -f docker-compose.yml -f docker-compose.sunucu.yml up -d --build
./docker/sertifika-al.sh            # SERTIFIKA_DENEME=1 for a Let's Encrypt staging run
```

Until the certificate exists Nginx serves a temporary self-signed one, so it
can start and answer the HTTP-01 challenge. Needs Docker Compose 2.24+.

The Android app connects to exactly one server, fixed at build time: `./apk.sh`
embeds `LONCA_SUNUCU_URL` (default `https://kozmos.42.fr`; a full `http://IP:3000`
works for local testing, `yok` builds an offline-only app). There is no network
scanning. The app sends the API key in `x-lonca-anahtar`, falls back to the bundled
offline snapshot when the server cannot be reached and retries once a minute.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the server with restart on file changes |
| `npm test` | API, authorisation, moderation, validation and journeyman-audit tests (25) |
| `npm run test:e2e` | End-to-end scenario in a real browser (run `npx playwright install chromium` first) |
| `npm run konum` | Finds work coordinates through Google Places / OpenStreetMap (`-- --dene` only prints) |
| `npm run vendor` | Re-bundles the real 3D library for the browser |
| `npm run lint` · `npm run format:check` · `npm run denetle` | ESLint, Prettier and data/module consistency checks (all run in CI) |

Branch flow (`dev` → `main` → `build`), CI jobs and APK releases are described in [docs/ci-cd.md](docs/ci-cd.md).

## Architecture

```
                       ┌─────────────── Lonca Studio (/studio) ───────────────┐
 master: "a timed game │ chat → POST /api/kalfa → AI (UstaGPT/Claude)         │
 about Bursa hans"     │   ↳ eser_ara tool: looks at real data                  │
                       │   ↳ modul_yaz → rules + TypeScript type check          │
                       │       (on failure: back to the model, max 3 tries)     │
                       │ live preview (same runner) → submit for approval       │
                       │ editor: publish / unpublish / archive / delete         │
                       └───────────────────────────────────────────────────────┘
                                             │ only "published" modules
                                             ▼
┌──────────── Lonca app (/app) ─────────────┐        ┌──── Server (Fastify) ────┐
│ home: çini tiles · profile · achievements │◄──────►│ /api/eserler (+nearby)    │
│ opening a module fills the screen         │        │ /api/moduller (+status)   │
│   ┌───────── sandbox iframe ─────────┐    │        │ /api/eser-oneriler        │
│   │ module.js (no network, no DOM)   │    │        │ /api/medya · /api/kalfa   │
│   │ import { sahne, eserler … }      │    │        │ JSON files (data/)        │
│   └──────────────────────────────────┘    │        └───────────────────────────┘
│ the app draws for the module: UI tree,    │
│ map, 3D, accessibility, theme; small      │
│ capsule (✕) to close                      │
└───────────────────────────────────────────┘
```

### A module is an independent mini app

A module is a single JS file exporting `export default async function basla()`.
It cannot write HTML, cannot reach the network or the device. It describes its
screen as a **UI tree** and the app draws it. That gives:

- **Security.** The module runs in an isolated iframe (no origin, CSP blocks the
  network). The user's location is never given to the module; it is only used by
  the server-side "nearby works" query.
- **Accessibility for every module, for free.** Screen-reader labels, keyboard
  navigation and Turkish text-to-speech. Every map has a list equivalent, every
  3D viewpoint has a button equivalent. The choices a user makes in the
  accessibility panel apply to all modules:
  - Reading: four text sizes, a legible typeface (Atkinson Hyperlegible), wider
    line and letter spacing.
  - Vision: high contrast, colour-blind-friendly colours (map categories are
    also distinguished by letters), reduced chrome, a clear focus ring.
  - Motion and touch: reduce motion (transitions, confetti and 3D flights turn
    off), large touch targets.
  - Audio: text-to-speech, reading speed, read-on-tap.
- **App feel.** A module picks its theme (`acik`, `parsomen`, `koyu`, `gece`
  backgrounds and six çini colours), draws its own cover, top bar, back button
  and tabs, and the app animates forward/back transitions. Only a small capsule
  remains in the top-right corner: appearance settings and close.

The SDK contract lives in `sdk/lonca-sdk.d.ts`:

| Part | Contents |
| --- | --- |
| `eserler` | `yakindaki`, `getir`, `liste`, `iliskiler` (küratörlü tarihsel bağlar), `yuzyilSecenekleri`, `karistir`, `tamlik` (which fields are recorded for a work) |
| `sahne` | `ayarla({ baslik, tema, sekmeler })`, `ciz(tree)`, `olaylar()`, `bildir`, `efekt` |
| Nodes (27) | `kapak`, `ust_cubuk`, `izgara`, `kaydirma`, `kart`, `eser`, `fotograflar`, `harita` (fog + `baglantilar`), `graf` (radial relationship graph), `sure` (countdown), `secenekler`, `girdi`, `rozet`, `istatistik`, `ilerleme`, `liste`, … |
| `ekran` | Windows that open above the app and can always be dismissed: `soru`, `kart`, `uc` (real 3D tour; ask `ucVarMi` first), `harita`, `galeri`, `zaman`, `sonuc`, `rozet`, `duzeltme` (report an error) |
| `profil`, `basarim`, `depo` | Nickname, level and score; per-module achievements; small per-module persistent store (records, progress). All on the device, no personal data. |

Map nodes can draw curated historical links (`baglantilar: [{ a, b, tur }]`), faint inter-city ghost links (`hayaletBaglantilar`), city labels (`etiketler`), and a fog-of-war overlay (`sis: { acik: [{ lat, lng, yaricap }], minPiksel? }`). `graf` draws one work in the centre with its linked works around it; tapping a node emits the usual `{ tur: "dokun", id, eser }` event.

Example modules are in `sdk/ornekler/`: `hanlar-rehberi.js` (cover, screen
stack, collection) and `yuzyil-avi.js` (lobby, timed rounds, streak bonus,
record). The journeyman learns from these two examples.

**Showcase: Bursa Pusulası (Bursa Compass)** (`sdk/ornekler/bursa-pusulasi.js`,
published). It demonstrates almost the entire SDK in one standalone app:

- Cover, four tabs (Explore, Map, Game, Collection), each with a forward/back
  screen stack.
- Explore: work of the day, highlights, search, category and "complete data"
  filters, pagination, architectural glossary.
- Work page: photo gallery, real 3D (when available), century estimate,
  favourite, info card (`eserler.tamlik`), error report.
- Map: category filter, tap a pin for a summary; "Nearby works" shows the eight
  closest works with distances (the location is never handed to the module; if
  it cannot be obtained, the app says the results are relative to central Bursa).
- Game: "Century Hunt" and "Which is older?"; timer, streak bonus, records,
  effects.
- Collection: statistics, favourites, 10 achievements, records — all persisted
  through `depo`.

**Showcase: Sisli Vakıf Atlası** (`data/moduller/sisli-vakif-haritasi.js`, published).
A dark, globe-like fog-of-war atlas across nine cities: Bursa, İzmir, Edirne,
İstanbul, Konya, Mardin, Balıkesir, Kütahya and Bilecik. Opened cities glow in
the dark; clusters become glowing dots and split as you zoom. Curated historical
links are drawn as curved arcs (same külliye, patron, architect, endowed han,
dynasty, trade network, explicit textual mention, historic neighbourhood).
Opening a work shows its photos, inventory/Wikipedia text, source, a radial
relationship graph and a link list with the explanation and source behind every
relationship. A mühür economy lets you reveal the next hidden city when stuck.

**Completeness filters:** `eserler.liste({ tam: true })` returns works with every
core field (name, category, province, district, century, location, address,
history). `{ eksik: "konum" }` returns only those missing that field;
`{ gerekli: ["fotograf", "yuzyil"] }` and `{ olmayan: [...] }` combine required
and absent fields. The same filters are available over HTTP through
`GET /api/eserler?tam=1&eksik=…&gerekli=…&olmayan=…`, with a summary at
`GET /api/eserler-tamlik`. Studio → Content exposes them.

## The AI journeyman

1. The chat and the current code go to `POST /api/kalfa`. The API key stays on
   the server.
2. The journeyman knows the SDK contract, the rules and the two example apps. It
   uses the `eser_ara` tool to look at what is actually in the database, and
   delivers the module through the `modul_yaz` tool.
3. The code is audited:
   - Only `@lonca/sdk` may be imported; `eval` and dynamic import are forbidden.
   - Unknown node types, icons, 3D focus and theme names are rejected.
   - A module must be an app (`sahne.ayarla` is mandatory).
   - At most 2000 lines.
   - Because the event loop never ends, helpers declared with `const`/`let` after
     the loop are rejected (write `function` instead).
   - Finally, the code is type-checked against the SDK types. The DOM library is
     not loaded, so `document` or `fetch` is a type error.
4. On failure, the errors are sent back to the model in Turkish, up to three
   attempts. Unverified code never reaches the master. Code written by hand and
   submitted for approval goes through the same audit.
5. History is never invented: every fact about a work (name, century, history,
   source, photo) is read from the data while the module runs.

## Data

`data/eserler.json`: **187 works** across nine cities. **165 works** come from
Vakıf Katılım's *Bursa Vakıf Eserleri Envanteri* (three volumes); **22 works**
from İzmir, Edirne, İstanbul, Konya, Mardin, Balıkesir, Kütahya and Bilecik were
curated with Turkish Wikipedia text, coordinates and Wikimedia Commons photos
(CC BY-SA). 49 works currently have coordinates and appear on the atlas.

- **History and source:** Turkish and English history text, plus the source
  (volume and page).
- **Century:** filled only when the book states a construction date. Repair
  dates are not construction dates; without a date the field stays empty.
- **Photos:** **480 photos** across 187 works. Bursa photos come from the books;
  the new city photos come from Wikimedia Commons and are stored locally.
- **Location:** the books carry no coordinates. Manually entered approximate
  locations are used for known buildings, together with positions found by
  `npm run konum`. Approximate locations are labelled as such in the app
  (spec §5.1.3: unverified information is not presented as certain).
- **Historical links:** `data/eser-iliskileri.json` holds curated links between
  works (same külliye, patron, architect, endowed han, dynasty, explicit textual
  mention, historic neighbourhood). Every link includes a Turkish explanation
  and the inventory volume/page it comes from. They are never inferred from
  name similarity; the server exposes them at `GET /api/eser-iliskileri` and
  the SDK at `eserler.iliskiler()` / `eserler.iliskiler(id)`.

Data pipeline (`araclar/`):

| Tool | What it does |
| --- | --- |
| `kitap-ice-aktar.py` | Reads PDF text with positions. Splits two-page spreads, TR/EN columns and complex sub-sections, and repairs broken "Ş/İ" characters. |
| `foto-cikar.py` | Extracts photos with their position on the page and attaches each to the work that starts before it. Section covers go to the next work. |
| `veri-olustur.py` | Merges manual corrections (`data/bursa-ek.json`) with the photos. |
| `sehir-ekle.mjs` | Adds the curated city records from Turkish Wikipedia + Wikimedia Commons (text, coordinates, local photos). |

```bash
python3 araclar/kitap-ice-aktar.py kitaplar/bursa-envanteri-cilt-*.pdf > /tmp/ham.json
python3 araclar/foto-cikar.py /tmp/ham.json kitaplar/bursa-envanteri-cilt-*.pdf > data/bursa-fotograflar.json
python3 araclar/veri-olustur.py /tmp/ham.json data/bursa-ek.json data/bursa-fotograflar.json > data/eserler.json
```

Adding another city only needs records with the same fields: `il`, `ilce`, `ad`,
`tur`, `yuzyil`, `konum`, `tarihce`, `fotograflar`, `kaynak`. Modules are
city-agnostic (`eserler.liste({ il })`).

## Content management and moderation

- **Community contributions:** the citizen app has "Suggest a work" (name,
  category, history, source, up to six photos) and "Report an error" on every
  work. Everything lands in an **approval queue** and stays out of the app until
  approved. Uploaded photos are private until published too.
- **Studio → Content:** editors review suggestions, compare old and new values
  side by side, and can correct them while approving. Works can be added,
  edited and deleted directly, and every record requires a source.
  - **Photos:** up to 12 photos per work, drag and drop, reorder, choose a
    cover. On an existing work these changes save immediately, each with a
    ten-second "Undo" notice.
  - **Unsaved changes:** if you try to switch work or tab with unsaved edits,
    Studio asks (save / discard / go back).
  - **Change history:** every add, edit, delete, approval and import is recorded
    (last 300 operations). Any of them can be undone with one click, and the undo
    itself can be undone.
  - **Export / import:** all works download as a single JSON file. Import offers
    "merge" or "replace everything". If a single record is invalid, nothing
    changes; imports can be undone from the history too.
- **Studio → Modules:** a module's lifecycle is pending → published → unpublished
  ↔ archived; rejected or removed modules can be deleted permanently.

## Security

- **Input validation:** every input is validated on the server
  (`server/dogrulama.js`): unknown fields are dropped, strings trimmed. Photo
  URLs may only be local `/medya/...` or `https://`. Uploaded files are checked
  against their first bytes to confirm they really are JPEG, PNG or WebP.
- **Admin rights:** admin actions require the `x-yonetici-sifre` header, compared
  in constant time. A non-admin cannot overwrite a published module.
- **API key:** with `LONCA_API_ANAHTARI` set, `/api` is closed to anyone without
  the main key, a paired device key or a browser login cookie
  (`server/erisim.js`). Device keys are stored only as SHA-256 hashes in
  `data/cihazlar.json`. Traffic on the LAN is plain HTTP, so use it only on a
  network you trust.
- **Rate limiting:** the journeyman, suggestions and uploads are rate-limited per
  IP.
- **Personal data:** profile and achievements stay on the device. Location goes
  to the server only for the "nearby works" query and is not stored.

## Real 3D

If the server has `GOOGLE_HARITA_ANAHTARI` and the work has a known location,
the 3D view opens Google's **Photorealistic 3D Tiles** city model
(`public/app/uc-gercek.js`, [3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS)).
The earlier representational (hand-built) 3D models were removed: every work
looked the same and they did not reflect reality. Without a key or a location,
`ekran.ucVarMi(eser)` returns false and modules never show the 3D button; the
journeyman follows the same rule. If loading fails, the window shows the work's
photo and a short description.

## Folders

```
server/       uygulama.js (routes) · kalfa.js · dogrulama.js · guvenlik.js · depo.js
sdk/          lonca-sdk.js (runs inside the module frame) · lonca-sdk.d.ts (contract) · ornekler/
public/app/   citizen app: app.js · sahne.js (UI tree) · ekranlar.js · harita.js · uc.js · uc-gercek.js · profil.js
public/studio Studio: workshop, modules, content
public/ortak  design (çini palette, fonts), çini pattern generator, illustrations, animations, icons
data/         eserler.json · moduller/ · eser-oneriler.json · yuklenen/
araclar/      data pipeline and the location tool
test/         node:test suites · e2e/ end-to-end scenario
```

## Licenses

- **Code:** Team Kozmos.
- **Fonts:** SIL OFL (`public/ortak/fontlar/LICENSE.md`).
- **Libraries:** Leaflet BSD-2; three.js and 3d-tiles-renderer MIT.
- **Bursa work texts and photos:** © Vakıf Katılım, *Bursa Vakıf Eserleri Envanteri*.
  Used within the scope of the hackathon; the repository is private for this
  reason.
- **New city texts and photos:** Turkish Wikipedia and Wikimedia Commons,
  CC BY-SA 4.0; each record carries its page/source link.
- **Map data:** © OpenStreetMap contributors or © Google.
