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


## V3
- Photographies aériennes IGN (Géoplateforme WMTS ORTHOIMAGERY.ORTHOPHOTOS) à la place du fond Esri.
- Zoom tactile à deux doigts.
- Bouton × pour fermer le panneau Couches.
- Libellé de données rendu indépendant du numéro de version.


## V4 — données eau
- 9 repères de plans d’eau localisés à partir de sources publiques recoupées.
- Potabilité laissée à « Non renseignée » en l’absence d’information explicite.
- Hydrographie linéaire non inventée : intégration BD TOPAGE à poursuivre avec géométries officielles.


V6 : symbologie métier renforcée (halo), points conservés à petite échelle, support Polygon/MultiPolygon à partir du zoom 14, hydrographie détaillée à partir du zoom 12.5, une seule popup et fermeture au clic hors objet. Les 9 repères V5 sont conservés ; aucune géométrie officielle non vérifiée n'a été inventée.


## Données V8
- 11 repères mares / plans d’eau (dont Grande Mare et Mare des Cormiers ajoutées).
- 3 sources hydrographiques localisées : Vesgre, Guesle, Guéville.
- Potabilité jamais déduite : elle reste « Non renseignée » sans donnée explicite.
- hydrographie.geojson et points_eau.geojson restent volontairement vides tant qu’aucune géométrie locale fiable n’a été intégrée.
