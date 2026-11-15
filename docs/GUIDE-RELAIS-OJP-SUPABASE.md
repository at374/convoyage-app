# Installer le relais OJP Suisse sur Supabase

But : permettre à l'application de demander trajets et prix suisses sans jamais contenir le jeton
opentransportdata.swiss. Le jeton reste dans les secrets du projet Supabase.

Ce que la fonction fait et ne fait pas :
- elle transmet une requête OJP à `https://api.opentransportdata.swiss/ojpfare` et renvoie la réponse ;
- elle n'accède à aucune table, ne modifie ni l'authentification ni la synchronisation des missions ;
- elle n'accepte que les utilisateurs connectés à l'application ;
- service gratuit côté opentransportdata.swiss ; les fonctions Supabase sont incluses dans l'offre gratuite
  dans la limite de son quota mensuel.

## Installation (tableau de bord Supabase, sans ligne de commande)

1. Ouvrir le projet Supabase de Convoyage Ultra → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom de la fonction : `ojp-relais` (exactement).
3. Coller le contenu du fichier `supabase/functions/ojp-relais/index.ts` du dépôt, puis **Deploy**.
4. Laisser l'option **Verify JWT** activée (réglage par défaut).
5. **Edge Functions** → **Secrets** → ajouter `OJP_FARE_API_KEY` avec le jeton OJP Fare
   (le même que celui du secret GitHub). Ne le coller nulle part ailleurs.

## Vérification

Une fois la fonction installée, l'application connectée interroge
`https://<projet>.supabase.co/functions/v1/ojp-relais`. Réponses attendues :
- fonction absente : 404 → l'application garde le moteur suisse actuel, sans prix OJP ;
- secret absent : 503 ;
- utilisateur non connecté : 401.

## Retrait

Supprimer la fonction `ojp-relais` et le secret `OJP_FARE_API_KEY` dans le tableau de bord : l'application
revient d'elle-même au fonctionnement actuel.
