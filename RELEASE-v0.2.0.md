# Release v0.2.0 – Anpassen im Training, Planversionen, Planer

- Schulterdrücken (Fitnessstudio): 3 statt 2 Sätze – als Planversion 2
- Im Training je Übung (⋯): heute überspringen, heute ersetzen, dauerhaft ersetzen, aus dem Plan entfernen
- „+ Übung hinzufügen“: zusätzliche Übungen für heute aus dem gesamten Bestand, mit Suche; auf Wunsch dauerhaft übernehmen
- Plan als Daten in der Datenbank (Tabelle `plans`) mit Name und fortlaufender Version
- Bearbeiten sammelt Änderungen und speichert sie als neue Version (Änderungsliste + Grund); Verlauf, Ansehen, Wiederherstellen
- Planer-Fragebogen; Vorschläge von Claude erscheinen als Entwurf und können mit Startdatum angewendet werden; alter Plan geht ins Archiv und kann wieder aktiviert werden
- Ruhetage im Plan möglich
- Tests: 21 Server-/Regel-Tests, Klicktest mit allen neuen Abläufen (hell und dunkel)
