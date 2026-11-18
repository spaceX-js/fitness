# Fitness

Persönliche Trainings-App für den 8-Wochen-Plan „Phase 2“ (Zuhause + 1× Fitnessstudio, Calisthenics, Mobility, Laufen).
Läuft kostenlos auf Cloudflare Workers mit einer D1-Datenbank. Nur für eine Person, mit Passwort **und** Zwei-Faktor-Code.

## Funktionen

- **Heute**: Einheit des Tages, Woche X von 8, Vorschläge des Coachs, optionale Morgen-Mobility, Wochenübersicht
- **Krafttraining**: jede Übung mit kurzer Strichfiguren-Animation und 3 Ausführungs-Hinweisen; Sätze mit Wiederholungen und Gewicht abhaken; danach startet der Pausen-Timer (Ton + Vibration); Halte-Übungen (Plank, L-Sit …) mit Countdown, bei „je Seite“ automatisch zweimal; „Letztes Mal“ als Orientierung
- **Laufen**: Anweisungen je Woche (Zone 2, Intervalle, langer Lauf), Pulszonen, Schritte abhaken, optional Dauer/Distanz/Puls eintragen
- **Erholung / Mobility**: 16 Übungen mit Animation, Timer und Haken, Spaziergang
- **Abschluss**: Gefühl (zu leicht … zu schwer), Beschwerden je Körperregion, Notiz
- **Coach** (`public/coach.js`, feste Regeln, keine KI): Steigern nach zwei Einheiten am oberen Ende (mit Gewicht konkret +2,5/5 kg), leichter bei zu wenig Wiederholungen, Ersatzübungen bei Einschränkungen (und zurück, wenn sie weg sind), Krankheit (Kopf = locker, Körper/Fieber = Pause, danach Wiedereinstieg), Deload bei mehrmals „zu schwer“, Woche wiederholen bei vielen Ausfällen, Zone-2-Läufe zu schnell. Jeder Vorschlag wird nur auf Knopfdruck übernommen
- **Im Training (Menü ⋯ je Übung)**: heute überspringen, heute ersetzen, dauerhaft im Plan ersetzen oder entfernen; „+ Übung hinzufügen“ aus dem gesamten Bestand (mit Suche)
- **Plan mit Versionen**: Name + fortlaufende Version; „Bearbeiten“ sammelt Änderungen (Übung tauschen, Sätze, Wiederholungen, Reihenfolge, hinzufügen, entfernen) und speichert sie als neue Version mit automatischer Änderungsliste und optionalem Grund; Verlauf mit „Ansehen“ und „Wiederherstellen“
- **Planer**: Fragebogen für einen neuen Plan (Ziele, Tage, Zeit, Studio, Läufe, Ausrüstung, Dauer, was gut/schlecht war). Claude liest die Angaben (`settings.planner`) und legt Vorschläge als Entwurf an (`plans.status = 'draft'`); in der App ansehen und mit Startdatum anwenden – der alte Plan kommt ins Archiv und kann wieder aktiviert werden
- **Statistik**: Einheiten und Laufkilometer pro Woche, Planquote, Zone-2-Pace-Verlauf, Kraft-Fortschritt je Übung
- **Ich**: Krank/Einschränkungen, Planstart, Passwort ändern, andere Geräte abmelden, Datenexport (JSON)

## Sicherheit

- Anmeldung: Passwort (PBKDF2-SHA256, 100.000 Runden) + TOTP-Code (Authenticator / iPhone „Passwörter“); 8 Notfall-Codes (einmalig, nur als Hash gespeichert)
- Einrichtung nur mit einmaligem Einrichtungscode (`settings.setup_hash`), danach gelöscht
- Sitzungen: zufälliger 256-bit-Wert im Cookie `__Host-fit` (HttpOnly, Secure, SameSite=Strict), in der DB nur als SHA-256; 30 Tage; „andere Geräte abmelden“; Passwortwechsel meldet alle anderen ab
- Sperre nach 5 Fehlversuchen je Adresse (15 Min.) bzw. 30 insgesamt pro Stunde; Codes können nicht zweimal benutzt werden
- Strenge Content-Security-Policy (nur eigene Skripte), HSTS, kein Einbetten, `noindex`; API-Schreibzugriffe nur mit Header `X-Fit` und eigener Herkunft
- Eingaben werden geprüft und begrenzt; Fehlermeldungen ohne Interna; Worker-Logs aus (`observability`)
- Ohne Anmeldung erreichbar: nur Login, `style.css`, Icon und Manifest

## Aufbau

| Datei | Zweck |
|---|---|
| `src/index.js` | Worker: Einrichtung, Anmeldung, API (`/api/state`, `/api/log`, `/api/log/delete`, `/api/settings`, `/api/export`, `/api/password`, `/api/logout-all`) |
| `src/auth.js` | PBKDF2, TOTP (RFC 6238), Zufallswerte |
| `public/plan.js` | Übungsbibliothek, Standardplan, Prüfung (`validatePlan`) und Änderungsliste (`diffPlans`) für Pläne |
| `public/coach.js` | Regeln für Empfehlungen und Anpassungen |
| `public/anim.js` | Strichfiguren-Animationen (SVG) |
| `public/app.js`, `index.html`, `style.css` | Oberfläche |
| `d1-schema.sql` | Tabellen `settings`, `sessions`, `login_attempts`, `logs`, `plans` |
| `test/*.test.mjs` | Tests (`npm test`) |
| `test/dev.mjs`, `test/e2e.mjs` | Lokaler Testserver (Einrichtungscode `TEST-CODE-1234`) und Klicktest mit Playwright |

## Veröffentlichen

Cloudflare baut automatisch bei jedem Push auf `main` (Workers Builds, mit GitHub verbunden). Datenbank: `fitness-db`.

## Neuer Plan von Claude (Ablauf)

1. In der App: Plan → Neuer Plan → Fragebogen speichern
2. Claude liest `settings.planner` und die Trainings (`logs`), baut einen Plan im Format von `DEFAULT_PLAN`, prüft ihn mit `validatePlan` und trägt ihn als `draft` in `plans` ein (`note` = Begründung, `changes` = Liste der Änderungen)
3. In der App: Vorschlag ansehen → Startdatum → Anwenden

## Zugang zurücksetzen (falls Handy und Notfall-Codes weg sind)

In D1 `pw_hash` löschen und einen neuen `setup_hash` (SHA-256 eines neuen Einrichtungscodes) eintragen; dann beim nächsten Aufruf neu einrichten. Die Trainingsdaten bleiben erhalten.
