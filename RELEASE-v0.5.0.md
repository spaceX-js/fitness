# Release v0.5.0 – Health-Übertragung ohne Rechenzeit-Grenze

- Problem: Mit Herzfrequenz kommen tausende Messungen; die Auswertung brauchte mehr Rechenzeit, als der kostenlose Cloudflare-Tarif pro Anfrage erlaubt („Worker exceeded resource limits“)
- Lösung: Der Server speichert die Übertragung nur (Tabelle `health_raw`), ausgewertet wird beim Öffnen der App im Browser; nur die Ergebnisse (Tageswerte, Läufe) gehen zurück (`/api/health/raw`, `/api/health/apply`), danach wird die Rohübertragung gelöscht
- Auswertung ~40× schneller (Zeitzonen und Zeitangaben zwischengespeichert, schnellere Doppelzählungs-Prüfung)
- Summen wie Apple Health: Watch zählt, iPhone nur für Lücken; Zahlen in Exponentialschreibweise werden richtig gelesen
