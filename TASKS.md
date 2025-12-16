# Aufgabenübersicht – STACFinder Collection Search UI

## Branches
- main: ursprünglicher Code
- dev: Entwicklung für die Collection Search (development branch)
- weitere Branches z.B. feature/filter-panel oder feature/result-list von dev ausgehend hinzufügen

## Layout
- Such- und Filterbereich: Freitext-, Zeit-, Raum-, Metadateneingabe
- Ergebnisbereich: Liste mit Ergebnissen als Card mit wichtigsten Metadaten + Karte mit räumlicher Ausdehnung 
- Detailansicht: zusätsliche Seite mit vollständigen Informationen zur Collection (öffnet sich bei Klick auf einzelnes Ergebnis)

## API Integration  
Momentan nur für Development, für Production noch anpassen
- Proxy in vue.config.js 
- Service-Datei für API (src/services/collectionApi.js) 
- UI kann im Dev über Axios auf die API zugreifen, ohne CORS-Probleme
  
# Backend starten mit Docker: 
- Repo vom STACFinder clonen 
- Docker muss installiert sein und laufen
1. API konfigurieren
- im Terminal: cp api/.env.example api/.env
- in der Datei api/.env das Passwort in DB_PASS setzen
2. Crawler konfigurieren
- im Terminal: cp crawler/.env.example crawler/.env
- in der Datei crawler/.env das Passwort in DB_PASS setzen
3. Docker starten
- dann im Terminal: docker-compose up --build 
  --> läuft auf http://localhost:4000
# UI starten 
- Repo vom STAC Browser clonen 
- npm install (beim ersten Mal)
- npm start
  --> läuft auf http://localhost:8080

# nur Api lokal starten (kann ignoriert werden)
- Repo vom STACFinder clonen 
- cd api 
- npm install (beim ersten Mal)
- npm run dev
  --> läuft auf http://localhost:3000
  
Was jetzt funktioniert:
fetchCollections({
  q: 'sentinel',           // ✅ Textsuche
  limit: 20,               // ✅ Pagination
  sortby: 'title',         // ✅ Sortierung
  token: 'xyz'             // ✅ Navigation
});

- Textsuche nach Collections
- Sortierung nach Titel oder ID
- Pagination mit "Vorherige/Nächste" Buttons
- Klick auf Collection → Detailseite
- Alle Metadaten werden angezeigt

## Fragen  
- Wie alle Ergebnisse auf einer Karte darstellen?

## Aufgaben
Legende Status: Offen | Bearbeitung | Fertig

### Allgemeine Aufgaben 
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Fork des STAC Browser Repos und in Projekt Repo integrieren | Fertig     |  Hannah               |
| Struktur und Komponenten des bestehenden STAC Browsers analysieren |Fertig| Beide                |
| Technologieauswahl und Setup                               | Fertig      | Beide                 |
| Layoutkonzept und Seitenaufbau festlegen                   | Fertig      | Beide                 |
| Test-JSON erstellen, um Funktionalität ohne API zu testen  | Offen       |                       |

### Grundlayout  
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Grundgerüst der Seite anlegen: Header, Footer, Hauptbereich| Fertig      | Kian                  |
| Search Bar für Freitextsuche                               | Fertig      | Kian                  |
| Zeitraumfilter mit Date Picker                             | Fertig      |  Hannah               |
| Räumlicher Filter: Karte einbinden und zeichnen einer BBox ermöglichen | Fertig| Kian            |
| Filterpanel für Metadaten mit Dropdowns für Felder, Operatoren, Werte | Fertig| Hannah           |

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
| Verbindung zur API herstellen (Axios oder Fetch)           | Bearbeitung |  Hannah               |
| Parameterübergabe: Freitextsuche (titel, description usw.) | Bearbeitung |  Hannah               |
| Parameterübergabe: Zeitfilter (extent.temporal)            | Bearbeitung |  Hannah               |
| Parameterübergabe: Räumlicher Filter (bbox)                | Bearbeitung |  Hannah               |
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
| Navigation und Routing; Nutzer kann zwischen Seiten wechseln | Offen     |                       |

### Integration und Tests
| Aufgabe                                                    | Status      | Verantwortliche Person|
|------------------------------------------------------------|-------------|-----------------------|
| Zusammenspiel mit API-Team testen (Datenfluss, CQL2 Abfragen) | Offen    |                       |
| Dokumentation und Beschreibung der UI-Komponente           | Offen       |                       |
| Testen und Bugfixing                                       | Offen       |                       |
| End-to-End Test: Zusammenspiel aller Komponenten           | Offen       |                       |

---