# Release v0.3.1 – Dark Mode, kein seitliches Scrollen, kein alter Zwischenspeicher

- Ursache für weiße Tage-Kästchen und überstehende Wochenleiste: `style.css` wurde bis zu 1 Stunde zwischengespeichert. Jetzt `no-cache` und Versionsnummer an CSS und Skript (`?v=`), damit jedes Update sofort sichtbar ist
- Dark Mode überarbeitet: Karten mit feinem Rand, ruhigere Farbverläufe, lesbare Knöpfe, Badges, Hinweise, Pausen-Timer und Meldungen; native Bedienelemente (Datum) im dunklen Stil
- Kein seitliches Scrollen mehr: Wochenleiste und Wochenauswahl (W1–W8) passen in eine Zeile, lange Texte brechen um, seitliches Wischen gesperrt
- Klicktest prüft jetzt zusätzlich, dass kein Knopf oder Feld über den Bildschirmrand ragt
