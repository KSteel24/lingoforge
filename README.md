# LingoForge

100 % offline, private Sprachlern-PWA (aktuell nur Spanisch für Deutschsprachige; Englisch und Französisch sind vorbereitet, aber deaktiviert) als eine einzige `index.html`.
Kein Konto, keine Analyse, keine Telemetrie, keine Fremdserver, keine Fremdpakete. Lernstand bleibt in IndexedDB auf dem Gerät.

## Bauen und testen

Nur Node 24 (Built-ins), kein `npm install`.

```
node build/build.mjs            # erzeugt dist/index.html und dist/sw.js
node build/verify.mjs           # CSP-Hash, keine externen URLs, Syntax, verbotene Konstrukte
node --test "test/*.test.mjs"   # FSRS, Norm, Inhalt, Sitzung/Backup, Rauchtest der gebauten App
```

Hinweis: `node --test test/` (nur Ordner) funktioniert in Node 24 nicht, daher das Muster mit Anführungszeichen.

Aufbau: `src/` (Quellteile), `build/` (Build und Prüfskript), `test/`. Reine Module (`fsrs`, `norm`, `game`, `sched`, `backup`,
`content-*`) laufen unverändert im Browser und in Node (UMD-artig).

## Aktive Sprachen

Einzige Schalterstelle: `ENABLED_LANGS` in `src/js/content-lib.js` (aktuell `['es']`). Build, Standardsprache, Sprachauswahl, Fortschrittsschleife und Tests richten sich danach.
`content-en.js` und `content-fr.js` bleiben unverändert im Repo. Reaktivieren: Sprache in `ENABLED_LANGS` ergänzen, neu bauen.
Backup-Import: Karten, Verlauf und Tage deaktivierter Sprachen werden verworfen (die Vorschau nennt die Anzahl); ist im Backup eine deaktivierte Sprache als Lernsprache eingestellt, fällt die App auf die erste aktive (`es`) zurück. Der Verlauf ist auf 100000 Einträge begrenzt.

## Deploy

`dist/index.html` und `dist/sw.js` in dasselbe Verzeichnis eines beliebigen statischen HTTPS-Hosts legen, z. B. GitHub Pages.
HTTPS ist nötig, damit der Service Worker (Offline-Cache) funktioniert. Die CSP steckt als Meta-Tag in der Datei. Meta-CSP kann aber kein `frame-ancestors`; setze deshalb beim Hosting zusätzlich HTTP-Header, soweit der Host das erlaubt (GitHub Pages erlaubt keine eigenen Header, dann z. B. Cloudflare Pages, Netlify oder einen eigenen Webserver):

```
Content-Security-Policy: frame-ancestors 'none'
X-Content-Type-Options: nosniff
```

(Die Seiten-CSP aus dem Meta-Tag bleibt bestehen; mehrere CSPs werden gemeinsam angewendet.)

iPhone (iOS 17+): Seite in Safari öffnen, Teilen > "Zum Home-Bildschirm". Danach läuft die App offline.
Updates: Beim Öffnen prüft der Browser `sw.js`; gibt es eine neue Version, erscheint ein Banner "Neue Version verfügbar".
Erst nach Tipp auf "Jetzt aktualisieren" wird neu geladen (kein Zwangsreload).

## Datenschutz

- Alle Daten bleiben lokal (IndexedDB). Es gibt keine Netzaufrufe aus dem App-Code (`connect-src 'none'`).
- Einziger Netzverkehr: der Browser lädt die App-Dateien von deinem eigenen Host (und prüft `sw.js` auf Updates).
- Sprachausgabe nutzt die iOS-Stimmen des Geräts (`speechSynthesis`). Es gibt bewusst keine Spracherkennung,
  weil iOS dabei Audio an Apple senden kann. Nachsprechen wird nur selbst bewertet, nichts wird aufgezeichnet.
- Export/Import als JSON-Datei, Import mit Whitelist-Validierung, Größenlimit (8 MB) und Abwehr von `__proto__`/`constructor`.
- "Alles löschen" entfernt Datenbank, Caches und Service Worker (zweistufig). Bei Blockade (z. B. zweiter Tab) oder Fehler erscheint eine Fehlermeldung statt einer Erfolgsmeldung; Erfolg wird erst nach Prüfung gemeldet, dass die Datenbank weg ist.
- Der Service Worker liefert nur die Shell (`index.html`) aus und cached keine anderen Pfade.
- Speicher: Safari kann Daten lange nicht genutzter Webseiten löschen. `storage.persist()` wird ehrlich angezeigt, ist aber keine Garantie.
  Regelmäßig ein Backup exportieren (Erinnerung nach 7 Tagen oder 50 Wiederholungen).

## CSP-Entscheidungen

`default-src 'none'; script-src 'sha256-<Hash des Inline-Scripts>'; style-src 'unsafe-inline'; img-src data:; manifest-src data:;
connect-src 'none'; media-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'self'`

- `worker-src 'self'` ist nötig: Ohne diese Direktive fällt die Service-Worker-Registrierung auf `script-src` zurück, und die Hash-Quelle
  erlaubt `sw.js` nicht. Der Build berechnet den Hash automatisch.
- `connect-src` bleibt `'none'`: Die Seite ruft nie `fetch` auf. Cache und Update-Prüfung macht der Service Worker bzw. der Browser selbst.
- `style-src 'unsafe-inline'` wegen des Inline-`<style>`; Skripte bleiben hash-gebunden (kein `eval`, kein `innerHTML`, DOM nur über `h()` mit Attribut-Whitelist).
- Manifest und Icons sind data-URIs und enthalten bewusst kein `start_url`/`scope` (relative URLs wären gegen eine `data:`-URL ungültig).

## Sprachausgabe auf iOS

- `speechSynthesis.speak()` wird synchron aus dem Tap aufgerufen. `cancel()` nur bei laufender oder wartender Ausgabe (danach ca. 60 ms Pause), sonst verschluckt iOS die Äußerung; vor jedem `speak()` folgt `resume()`.
- `utterance.lang` wird auf Bindestrich normalisiert (`es_ES` wird `es-ES`). Ohne gelistete Stimme wird trotzdem mit der Systemstandard-Stimme der Sprache gesprochen.
- Der erste Tap "entsperrt" die Ausgabe mit einer stummen Äußerung (Lautstärke 0). Es gibt kein Autoplay; Hör-Übungen haben einen sichtbaren "Anhören"-Button.
- Kommt nach 1,5 s weder `start` noch `end`, oder gibt es einen Fehler, erscheint ein Toast samt Banner mit Hinweisen (Lautstärke, Stimmen-Download, Stumm-Schalter). Bis zur nächsten erfolgreichen Ausgabe werden Hör-Übungen durch Lese-/Tippvarianten ersetzt.
- Einstellungen > "Sprachtest" spricht "Hola, ¿cómo estás?" und zeigt die Diagnose: Anzahl `getVoices()`, die ersten 5 Stimmen (Sprache, lokal/online), gewählte Stimme und Sprache, `speaking`/`pending` direkt nach dem Aufruf und nach 300 ms sowie die Ereignisse start/end/error.
- Die CSP bleibt unverändert (`media-src 'none'`): Es wird kein Audio-Element und kein Audio-Trick verwendet, nur `speechSynthesis`.

## Native Anmutung

Eigener Scroller (kein Gummiband, kein Body-Scroll), `100dvh`, Safe-Areas, Statusleiste `black-translucent` mit Blur-Streifen, feste Tab-Leiste mit Blur, großer Titel, Press-Animationen (scale .97), Seitenübergänge und Richtig/Falsch-Animationen (alle aus bei `prefers-reduced-motion`),
`user-select: none` außer in Eingabefeldern, 16 px in Eingabefeldern gegen Auto-Zoom, `touch-action: manipulation` gegen Doppeltipp-Zoom. Pinch-Zoom bleibt aus Gründen der Barrierefreiheit erlaubt.
Im normalen Safari-Tab (nicht installiert) zeigt die Startseite einmalig den Hinweis "Zum Home-Bildschirm hinzufügen" (per Button oder Wischen schließbar, wird gemerkt).

## Lernlogik

- FSRS-5 mit Standardgewichten, Ziel-Retention einstellbar (0.80 bis 0.97), Intervall mindestens 1 Tag, maximal 36500.
- Sitzung: 15 Schritte, fällige Karten nach niedrigster Retrievability, ca. 2/3 Wiederholung und 1/3 Neues,
  Backlog-Dämpfung (mehr als 30 fällig: keine neuen, mehr als 15: halbes Budget), Fehler kommen 3 bis 4 Schritte später ohne FSRS-Update wieder.
- Übungstyp nach Stabilität: unter 2 Erkennen, 2 bis 10 Lücke/Kacheln/Nachsprechen, über 10 Tippen/Diktat.
- Ohne passende Stimme werden Hör-, Nachsprech- und Diktat-Übungen automatisch durch Lese- und Tippvarianten ersetzt.

## Ehrlicher Teststand

- Für FSRS-5 stand offline keine Referenzimplementierung zur Verfügung. Die Tests prüfen daher Eigenschaften
  (R(S,S)=0,9; Stabilität wächst bei Good/Easy; Again senkt sie; Monotonie Again < Hard < Good < Easy; D in [1,10]; Intervall = S bei 0,9),
  keine Referenzwerte. Die Formeln folgen der FSRS-5-Spezifikation aus dem Gedächtnis des Autors; Abweichungen von der offiziellen
  Implementierung sind möglich.
- Der Rauchtest führt den gebauten Code in Node mit einem DOM-Stub aus und nutzt den Speicher-Fallback. Der echte IndexedDB-Pfad,
  Safari-Eigenheiten (Sprachausgabe, Teilen-Dialog, Installation) und Darstellung sind nur auf einem echten iPhone prüfbar.
- Der Inhalt ist selbst verfasst. Die Tests prüfen Struktur und Konsistenz, nicht die Sprachrichtigkeit; ein Muttersprachler-Review wird empfohlen.

## Lizenz

MIT, siehe `LICENSE`.
