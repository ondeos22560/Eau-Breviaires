# Eau – Les Bréviaires / V1

Prototype PWA cartographique léger, destiné au PC et au smartphone, publiable sur GitHub Pages.

## Fonctions V1
- carte plein écran sans bibliothèque externe ;
- GPS haute précision si le navigateur l'autorise ;
- déplacement / zoom ;
- couches GeoJSON locales ;
- Service Worker pour le fonctionnement hors ligne après première visite ;
- avertissement explicite sur la potabilité ;
- première donnée vérifiée : Mare au Chanvre (OSM way 716023387, position publiée 48.70194 / 1.81792).

## Important
Cette V1 valide l'architecture technique. Elle ne prétend pas encore fournir un inventaire exhaustif des sources d'eau. Les extractions IGN BD TOPO, DDT78/BD TOPAGE et OSM doivent être intégrées après téléchargement et contrôle SIG. Les fichiers GeoJSON vides sont volontairement vides : aucune donnée n'a été inventée.

## Test local
Depuis le dossier : `python -m http.server 8000`, puis ouvrir `http://localhost:8000`.

## GitHub Pages
Déposer tout le contenu du dossier à la racine du dépôt (ou adapter les chemins si sous-dossier), puis activer Pages sur la branche principale.

## Sources / licences
- OpenStreetMap : © contributeurs OpenStreetMap, ODbL.
- Limites administratives : cible prévue API Découpage administratif / Etalab.
- IGN / DDT78 : à documenter précisément lors de l'intégration des extractions.
