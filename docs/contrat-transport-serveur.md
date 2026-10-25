# Contrat du calculateur de transports — Convoyage Ultra

**État : interface prête, serveur de calcul non installé.** Aucun horaire ni prix réel ne doit être affiché comme vérifié sans source.

## Activation

Le navigateur charge `transport-serveur.js` et `transport-config.js`.
L'adaptateur est **désactivé par défaut**. Un administrateur peut définir
`window.CPTransportBackendActive = true` **avant** le chargement de
`transport-config.js`, uniquement après avoir mis en place l'endpoint
`POST /api/transports/rechercher` sur la même origine.

Ne jamais placer de clé fournisseur dans les fichiers JavaScript publics.
L'endpoint doit être protégé par l'authentification existante et limiter
les requêtes côté serveur. L'activation ne doit pas être faite avant
validation des coûts éventuels : aucune API payante n'est autorisée.

## Requête JSON

```json
{
  "depart": "Annecy",
  "arrivee": "Lyon",
  "date": "2026-11-02",
  "heure": "",
  "contrainte": "arrivee_avant_prise_en_charge",
  "departAdresse": "Annecy",
  "arriveeAdresse": "Lyon Part-Dieu",
  "margeMinutes": 30,
  "limiteMissionAt": "2026-11-02T14:00:00+01:00"
}
```

`heure` est facultatif. Pour le retour, `contrainte` vaut
`depart_apres_livraison`. La date est celle du **départ du transport**
en fuseau Europe/Paris, et non nécessairement celle de la mission.

## Réponse JSON

```json
{
  "trajets": [
    {
      "departAt": "2026-11-02T09:00:00+01:00",
      "arriveeAt": "2026-11-02T11:00:00+01:00",
      "fournisseur": "Nom du réseau",
      "mode": "train",
      "prixEUR": null,
      "source": "https://source-officielle.example/itineraire",
      "verifieLe": "2026-11-02T08:55:00+01:00",
      "confirme": false
    }
  ]
}
```

Les données ci-dessus sont **uniquement un exemple de schéma, pas des
trajets réels**. `prixEUR: null` signifie tarif indisponible : ne jamais
remplacer par une estimation présentée comme vérifiée. `confirme: true`
n'est acceptable qu'avec une source vérifiable et un horodatage récent.
Une source n'atteste pas à elle seule la disponibilité à la réservation.

Répondre `{"trajets":[]}` quand aucune offre réelle n'est trouvée.
Ne jamais fabriquer d'itinéraire de secours. Maximum 500 trajets par
réponse. L'adaptateur navigateur coupe les requêtes après 3 secondes.

## Raccordement restant

1. Choisir un moteur d'itinéraires réel et ses jeux de données GTFS/
   GTFS-RT, en contrôlant la couverture et les licences.
2. Héberger un service de recherche derrière l'endpoint local ; gérer
   les horaires, correspondances, jours de circulation et fuseaux.
3. Ajouter les tarifs uniquement s'ils sont fournis par une source fiable.
4. Tester les résultats réels sur plusieurs lignes, jours fériés,
   trajets transfrontaliers et retards.
5. Activer le fournisseur après accord explicite sur l'hébergement et
   les éventuels coûts.

Le module multijours reste hors périmètre de cette intégration.
