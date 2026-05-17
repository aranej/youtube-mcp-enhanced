# YouTube MCP pre Codex App na Windows 11

Overene lokalne: `2026-05-17T17:15:00+02:00`

Tento navod je prakticky postup pre Windows 11 pouzivatela Codex App, ktory chce pouzivat tento `youtube` MCP server. Zakladny read-only rezim potrebuje iba YouTube Data API key. OAuth nastavuj iba vtedy, ked realne chces write tooly pre playlisty.

## Prompt pre bratov Codex

Toto je najbezpecnejsi prompt, ktory moze pouzivatel dat svojmu Codexu:

```text
Si Codex na Windows 11. Nastav mi lokalny YouTube MCP server podla dokumentu docs/windows-codex-app-setup-sk.md z repozitara youtube-mcp-enhanced.

Najprv iba over lokalnu realitu:
- git --version
- node --version
- npm --version
- py -3 --version
- existenciu %USERPROFILE%\.codex\config.toml

Potom:
1. Klonuj alebo aktualizuj repo youtube-mcp-enhanced do stabilneho lokalneho adresara.
2. Spusti npm ci, npm run build a py -3 -m pip install --user -U yt-dlp.
3. Priprav Codex MCP config blok pre [mcp_servers.youtube].
4. Nepostuj moje realne API/OAuth secrets do chatu a necommituj ich.
5. Ak API key nemas, nastav iba free Google Cloud/API Console cast: projekt, YouTube Data API v3, API key.
6. Google Cloud projekt je potrebny. Cloud Billing account nie je ciel a nechcem ho.
7. Ak Google Console pyta billing, platobnu kartu, Free trial, upgrade alebo navysenie kvoty, zastav sa. Nechcem nic platene.
8. OAuth nastav iba ak ta o to vyslovene poziadam; default je read-only.
9. Po zmene configu mi povedz, ze treba restartovat Codex App.
10. Po restarte over read-only smoke test na troch videach z dokumentu.
```

## Co tento server robi

- cita metadata videi, kanalov, komentarov a playlistov cez YouTube Data API v3,
- taha transcript/captions pre videa, na Windows s `yt-dlp` fallbackom,
- vracia pri video vysledkoch aj priame `url` a `videoId`,
- volitelne vie cez OAuth vytvarat playlisty a pridavat videa.

## Predpoklady

- Windows 11,
- Codex App,
- Git,
- Node.js `>=20.0.0`,
- npm,
- Python launcher `py`,
- Google ucet,
- pristup ku GitHub repozitaru `https://github.com/aranej/youtube-mcp-enhanced`.

## Bezpodmienecne free pravidlo

Ciel je `0 EUR`.

Pre YouTube Data API setup potrebujes:

- Google ucet,
- Google Cloud/API Console projekt,
- zapnuty `YouTube Data API v3`,
- API key obmedzeny na `YouTube Data API v3`.

Nepotrebujes a nemas vytvarat:

- Cloud Billing account,
- platobnu kartu,
- Free trial,
- plateny Google Cloud resource,
- quota increase alebo raise limit request.

Ak Google Console pyta billing, kartu, free trial, upgrade, marketplace nakup, trial aktivaciu alebo navysenie kvoty, zastav sa. V tomto navode je to stop condition, nie krok instalacie.

Overenie:

```powershell
git --version
node --version
npm --version
py -3 --version
```

## Instalacia projektu

Zvol si stabilny adresar. Priklad:

```powershell
New-Item -ItemType Directory -Force C:\AIprojekty\Codex | Out-Null
Set-Location C:\AIprojekty\Codex
git clone https://github.com/aranej/youtube-mcp-enhanced.git
Set-Location C:\AIprojekty\Codex\youtube-mcp-enhanced
npm ci
npm run build
```

Nainstaluj transcript fallback:

```powershell
py -3 -m pip install --user -U yt-dlp
py -3 -m yt_dlp --version
```

## Google Cloud Console navigacia

Lokalne overena trasa na Jozefovom ucte `slofo22@gmail.com`:

- project selector hore: vybraty projekt `n8n-VPS-CX32`,
- lave menu: `APIs & Services`,
- podmenu: `Enabled APIs & services`, `Library`, `Credentials`, `OAuth consent screen`,
- detail API: `YouTube Data API v3`,
- stav na detaile: `API Enabled`, tlacidlo `Manage`,
- `Manage` detail ma taby `Metrics`, `Quotas & System Limits`, `Credentials`.

Podla oficialnej Google dokumentacie je projekt potrebny: YouTube Data API vyzaduje Google ucet, projekt v Google Developers Console a zapnuty YouTube Data API v3. Projekt je miesto, kde sa zapne API, vytvori API key a sleduje quota usage.

Pre bratov projekt pouzi rovnake menu, len jeho Google ucet a jeho project selector:

1. Otvor `https://console.cloud.google.com/`.
2. Hore vyber spravny Google ucet.
3. Otvor project selector.
4. Ak uz ma vhodny projekt, vyber ho.
5. Ak nema vhodny projekt, vytvor novy projekt, napr. `youtube-mcp-free`.
6. Pri vytvarani projektu nevyberaj ani nevytvaraj Cloud Billing account. Ak je billing povinny alebo sa neda preskocit, zastav setup.
7. V projekte otvor `APIs & Services` -> `Library`.
8. Vyhladaj `YouTube Data API v3`.
9. Ak vidis `Enable`, zapni API. Ak vidis `API Enabled` alebo `Manage`, API uz je zapnute.
10. Otvor `Manage` -> `Quotas & System Limits` a skontroluj `Queries per day`.
11. Otvor `Credentials` pre API key.

Hard stop: neklikaj `Free trial`, `Billing`, `Raise daily token limit`, `Request quota increase`, upgrade ani nic s platobnou kartou. Ak Google Console pyta billing alebo platobnu kartu, zastav setup a najprv to prekonzultuj.

## Google API key

Podla oficialnej Google dokumentacie aplikacie pouzivajuce YouTube Data API potrebuju authorization credentials. Pre verejne/read-only poziadavky staci API key; OAuth je na privatne user data a write operacie.

Postup:

1. Otvor Google Cloud Console.
2. Vyber existujuci free projekt alebo vytvor novy projekt bez billing account.
3. Zapni `YouTube Data API v3`.
4. V `APIs & Services` -> `Credentials` pouzi `Create credentials` -> `API key`.
5. V detaile API key nastav `API restrictions` na `YouTube Data API v3`.
6. API key si uloz mimo repozitara. Necommituj ho.

Podla oficialnej Google dokumentacie maju projekty so zapnutym YouTube Data API default quota allocation `10,000 units per day`. Lokalny Jozefov projekt ukazuje `Queries per day = 10,000` a API funguje bez priradeneho Cloud billing account. Toto je quota model, nie ciel minat peniaze. Ak sa objavi platobny alebo billing krok, nepokracuj.

## Volitelny OAuth pre playlist write tooly

Toto preskoc, ak chces iba citat videa/transcripty/komentare.

Tento server pouziva:

- scope: `https://www.googleapis.com/auth/youtube`,
- callback: `http://localhost:8888/callback`,
- token file: `%APPDATA%\youtube-mcp-token.json`.

Postup:

1. V tom istom Google Cloud projekte otvor `Google Auth Platform` alebo `APIs & Services` -> `OAuth consent screen`.
2. Skontroluj alebo nastav zakladne branding/audience udaje.
3. Otvor `Google Auth Platform` -> `Clients`.
4. Vytvor `OAuth 2.0 Client ID`.
5. Pouzi typ `Desktop app`.
6. Uloz `Client ID` a `Client secret`.

Tento lokalny MCP server pocuva callback:

```text
http://localhost:8888/callback
```

Podla oficialnej Google OAuth dokumentacie je pre lokalne desktop apps urceny OAuth flow pre iOS/Desktop apps a loopback redirect cez `localhost`/`127.0.0.1` zostava podporovany pre desktop app klientov. YouTube Data API nepouziva service account flow pre user YouTube ucet, preto tu nepouzivaj service account.

## Codex App config

Otvor alebo vytvor:

```powershell
notepad $env:USERPROFILE\.codex\config.toml
```

Minimalny read-only config:

```toml
[mcp_servers.youtube]
command = "powershell.exe"
args = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", 'C:\AIprojekty\Codex\youtube-mcp-enhanced\scripts\launch-youtube-mcp.ps1']
startup_timeout_sec = 60.0
tool_timeout_sec = 180.0

[mcp_servers.youtube.env]
YOUTUBE_API_KEY = "PASTE_YOUR_YOUTUBE_API_KEY_HERE"
```

Ak mas OAuth a chces playlist write tooly, pridaj do rovnakej env sekcie:

```toml
YOUTUBE_OAUTH_CLIENT_ID = "PASTE_YOUR_OAUTH_CLIENT_ID_HERE"
YOUTUBE_OAUTH_CLIENT_SECRET = "PASTE_YOUR_OAUTH_CLIENT_SECRET_HERE"
```

Podla oficialnej OpenAI/Codex konfiguracnej dokumentacie je user config v `~/.codex/config.toml` a `mcp_servers.<id>` podporuje `command`, `args`, `env`, `startup_timeout_sec` a `tool_timeout_sec`.

Po zmene configu restartuj Codex App. Je to dolezite najma pri OAuth, lebo server cita env pri starte procesu.

## Smoke test v Codex App

Po restarte otvor novy Codex thread a poziadaj ho, aby pouzil `youtube` MCP server.

Read-only smoke:

```text
Pouzi youtube MCP server a over:
1. videos_getVideo pre https://youtu.be/lL1toTtiI28?si=oCMtLl0UC3INeO_2
2. transcripts_getTranscript pre videoId lL1toTtiI28 a language cs
3. transcripts_getTranscript pre videoId rBFyq3_-UE0 a language sk
4. transcripts_getTranscript pre videoId hDn8-fK3XaU a language en
5. videos_searchVideos pre query "Krásný omyl co mě iPhone Air naučil o životě"
Strucne vypis, co preslo a co nie.
```

Ocakavany signal:

- `videos_getVideo` vrati title, channel, duration a `url`,
- CZ transcript ma stovky entries a zacina približne `iPhone Air používám...`,
- SK transcript ma stovky entries a zacina približne `Milan Dubec ma hejtuje...`,
- EN transcript ma stovky entries a zacina približne `Coding's changing faster...`,
- search najde CZ video a vrati `videoId` aj `url`.

OAuth smoke iba po explicitnom rozhodnuti, ze chces write funkcionalitu:

```text
Pouzi youtube MCP server a zavolaj youtube_checkAuth. Nic nevytvaraj a nemen playlisty.
```

Ak odpovie `OAuth configured but not authenticated`, spusti OAuth flow az po vedomom suhlase. Write tooly `playlists_create`, `playlists_addVideo` a `playlists_addVideos` menia realny YouTube ucet.

## Lokalne overenie mimo Codex App

Toto je rychly test build/runtime vrstvy, nie plny MCP test:

```powershell
Set-Location C:\AIprojekty\Codex\youtube-mcp-enhanced
npm run typecheck
npm run build
npm audit --omit=dev
py -3 -m yt_dlp --version
```

Ak chces overit, ze launcher aspon startuje a vracia tool list:

```powershell
$payload = @'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual-smoke","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
'@
$payload | powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\scripts\launch-youtube-mcp.ps1
```

Vystup ma obsahovat `videos_getVideo`, `videos_searchVideos`, `transcripts_getTranscript`, `videos_getComments`, `channels_getChannel`, `channels_listVideos`, `playlists_getPlaylistItems` a volitelne OAuth/write tooly.

## Troubleshooting

MCP tooly sa v Codex App nezobrazia:

- restartuj Codex App,
- skontroluj cestu v `args`,
- over, ze existuje `dist\cli.js`,
- spusti `npm run build`,
- pozri, ci `config.toml` nema rozbity TOML zapis.

`YOUTUBE_API_KEY is missing`:

- env sekcia musi byt presne `[mcp_servers.youtube.env]`,
- hodnota musi byt v uvodzovkach,
- launcher cita config z `%USERPROFILE%\.codex\config.toml`, pokial nemas nastavene `CODEX_HOME`.

Metadata alebo komentare vratia 403:

- skontroluj, ci je zapnuta `YouTube Data API v3`,
- skontroluj API key,
- pozri kvotu v Google Cloud Console,
- ak si key restringoval, over, ze restrikcia povoluje YouTube Data API v3.

Transcript zlyha:

- spusti `py -3 -m yt_dlp --version`,
- ak chyba, pouzi `py -3 -m pip install --user -U yt-dlp`,
- nie kazde YouTube video musi mat dostupne captions v poziadanom jazyku.

OAuth/write nefunguje:

- over `YOUTUBE_OAUTH_CLIENT_ID` a `YOUTUBE_OAUTH_CLIENT_SECRET`,
- redirect URI musi byt `http://localhost:8888/callback`,
- port `8888` nesmie v case OAuth flow drzat iny proces,
- zmazanie `%APPDATA%\youtube-mcp-token.json` vynuti novu autorizaciu,
- pri OAuth consent screen moze Google zobrazit upozornenie na neoverenu appku, ak je projekt iba osobny/testovaci.

## Bezpecnostne pravidla

- Necommituj API key, OAuth secret ani token file.
- Neposielaj write tooly bez jasneho suhlasu pouzivatela.
- Pre bezny research pouzivaj read-only tooly.
- Pri zdielani navodu posielaj placeholdery, nikdy realne credentials.

## Zdrojove opory

- Lokalny audit: `docs/audit-2026-05-17.md`
- Lokalny launcher: `scripts/launch-youtube-mcp.ps1`
- OpenAI Codex config reference: https://developers.openai.com/codex/config-reference#configtoml
- Google YouTube Data API credentials: https://developers.google.com/youtube/registering_an_application
- Google YouTube Data API OAuth guide: https://developers.google.com/youtube/v3/guides/authentication
- Google YouTube Data API overview/project/quota: https://developers.google.com/youtube/v3/getting-started
- Google OAuth for desktop apps: https://developers.google.com/identity/protocols/oauth2/native-app
- Google OAuth redirect URI rules: https://developers.google.com/identity/protocols/oauth2/web-server
