# Aufgabenübersicht – STACFinder Collection Search UI

## Branches
- main: ursprünglicher Code
- dev/collection-search: Entwicklung für die Collection Search (development branch)
- weitere Branches z.B. feature/filter-panel oder feature/result-list von dev/collection-search ausgehend hinzufügen

## Layout
- Such- und Filterbereich: Freitext-, Zeit-, Raum-, Metadateneingabe
- Ergebnisbereich: Liste mit Ergebnissen als Card mit wichtigsten Metadaten + Karte mit räumlicher Ausdehnung 
- Detailansicht: zusätsliche Seite mit vollständigen Informationen zur Collection (öffnet sich bei Klick auf einzelnes Ergebnis)

## Fragen 
- Wie STAC Browser Code in Projekt Repo einbringen? 
- Wie alle Ergebnisse auf einer Karte darstellen?

## Aufgaben
Legende Status: Offen | Bearbeitung | Fertig

### Allgemeine Aufgaben 
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Fork des STAC Browser Repos und in Projekt Repo integrieren | Offen      |                       |
| Struktur und Komponenten des bestehenden STAC Browsers analysieren |Offen |                      |
| Technologieauswahl und Setup                               | Offen       |                       |
| Layoutkonzept und Seitenaufbau festlegen                   | Offen       |                       |
| Test-JSON erstellen, um Funktionalität ohne API zu testen  | Offen       |                       |

### Grundlayout  
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Grundgerüst der Seite anlegen: Header, Footer, Hauptbereich| Offen       |                       |
| Search Bar für Freitextsuche                               | Offen       | Hannah                |
| Zeitraumfilter mit Date Picker                             | Offen       |                       |
| Räumlicher Filter: Karte einbinden und zeichnen einer BBox ermöglichen |Offen |                  |
| Filterpanel für Metadaten mit Dropdowns für Felder, Operatoren, Werte |Offen |                   |

### Ergebnissanzeige und Detailansicht 
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Anzeigen der Collections mit wichtigsten Metadaten in Liste| Offen       |                       |
| Karte mit räumlicher Ausdehnung der Ergebnisse             | Offen       |                       |
| Pagination bei langen Ergebnislisten                       | Offen       |                       |
| Detailseite mit vollständigen Metadaten (bei Klick auf Ergebnis) | Offen |                       |
| Link zur Originalquelle (API, Katalog) auf Detailseite einbringen |Offen |                       |

### API-Integration
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Verbindung zur API herstellen (Axios oder Fetch)           | Offen       |                       |
| Parameterübergabe: Freitextsuche (titel, description usw.) | Offen       |                       |
| Parameterübergabe: Zeitfilter (extent.temporal)            | Offen       |                       |
| Parameterübergabe: Räumlicher Filter (bbox)                | Offen       |                       |
| Zusammensetzten von mehreren Metadaten Filtern in CQL2-Ausdruck und an API übergeben |Offen |    |
| Ergebnisse der passenden Collections von der API empfangen | Offen       |                       |

### Design, Usability & Feedback 
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Farbschema und Anordnung der Elemente auf der Seite        | Offen       |                       |
| Icons für Suche, Zeitfilter, Karte usw. hinzufügen         | Offen       |                       |
| Nutzerfeedback anzeigen, z.B. "x Collections gefunden"     | Offen       |                       |
| Fehlermeldungen verständlich anzeigen                      | Offen       |                       |
| Responsive Design sicherstellen                            | Offen       |                       |

### Integration und Tests
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Zusammenspiel mit API-Team testen (Datenfluss, CQL2 Abfragen) | Offen    |                       |
| Dokumentation und Beschreibung der UI-Komponente           | Offen       |                       |
| Testen und Bugfixing                                       | Offen       |                       |
| End-to-End Test: Zusammenspiel aller Komponenten           | Offen       |                       |

---