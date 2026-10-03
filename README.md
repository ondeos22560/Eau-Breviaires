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

## V10 — interface et cache
- OSM sélectionné par défaut au démarrage.
- Symbole/couleur intégré directement à chaque ligne de couche ; suppression de la légende redondante sous les cases.
- Position GPS conservée sur la carte sans ligne de légende supplémentaire.
- Les points ajoutés localement restent enregistrés sur l'appareil et sont maintenant également cliquables pour ouvrir leur fiche.
- Cache `eau-breviaires-v10` et stratégie réseau d'abord pour les fichiers de l'application, avec repli sur le cache hors ligne, afin d'éviter l'affichage persistant d'une ancienne interface après déploiement.


## V11 – données réelles
Secteur de travail : 1.70–1.90 E / 48.64–48.76 N. Hydrographie et polygones de plans d’eau extraits de BD TOPAGE 2026. Sources et autres détails hydrographiques extraits de BD TOPO 3.5 D078 du 15/06/2026. Les 11 repères de mares/plans d’eau de la V10 sont conservés. Potabilité non renseignée par défaut.


## V22
- Correction : les messages d'état (barre en bas/haut) ne s'affichaient jamais (conflit avec window.status).
- Street View général : ouverture par lien, seuil de déplacement avant clic (plus d'ouverture après un glissement).
- KML : description HTML avec lien Street View cliquable, ExtendedData, partage mobile avec repli téléchargement.
- Clic : points prioritaires sur polygones ; pas de clic sur objets non dessinés à faible zoom.
- Version V22 visible (bandeau PC, badge mobile, panneau Couches) ; cache SW eau-breviaires-v22 ; rechargement auto à la mise à jour.


## V23 — fiabilisation hors ligne
- Service Worker : l'application est servie depuis le cache (instantané, sans réseau ou avec réseau faible), puis rafraîchie en arrière-plan. Installation sans cache HTTP.
- Tuiles OSM / IGN déjà consultées conservées (max 800) et réutilisables hors ligne ; ce cache survit aux changements de version.
- Les tuiles en échec sont de nouveau demandées au retour du réseau (avant : définitivement blanches jusqu'au rechargement).
- Messages Hors ligne / Connexion rétablie ; Street View indique qu'il faut Internet.
- Enregistrement des points sécurisé (message d'alerte si le stockage du navigateur est refusé) ; stockage persistant demandé.
- Icônes PWA ajoutées (installation sur l'écran d'accueil).
- Pas de rechargement automatique pendant la saisie d'un point.


## V24
- Icônes PWA rangées dans le dossier icons/ (manifest, index.html et Service Worker mis à jour). Aucune autre modification.


## V25
- Street View général : un repère orange (losange) marque temporairement l'endroit cliqué. Il disparaît au prochain clic sur la carte, à l'activation d'un outil, ou après 30 s. Distinct des points rouges (observations), du GPS (cible cyan) et de l'hydrographie.


## V26
- Ajout d’un bouton `Infos` sur PC et mobile.
- Fenêtre de présentation de l’application avec avertissement de potabilité et contact `joyeux.xavier@gmail.com`.
- Guide PDF d’installation intégré pour iPhone, Android et PC.
- Le guide PDF est inclus dans le cache hors ligne de l’application.
- Cache applicatif : `eau-breviaires-v26`.


## V29

- Zoom PC à la molette centré sur la position du curseur : le point visé reste sous la souris pendant le zoom.
- Aucun changement du zoom tactile/pincement.
- Cache applicatif : `eau-breviaires-v28`.


V29 : interface mobile terrain avec GPS et Street View fixes en haut, tiroir de fonctions en bas et choix du fond de plan dédié.
