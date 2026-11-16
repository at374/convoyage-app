# OTP2 — Sources françaises AURA vérifiées (16 novembre 2026)

## 1. Sibra Grand Annecy
- Catalogue officiel PAN : https://transport.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs/?locale=fr
- Page de la ressource : https://transport.data.gouv.fr/resources/80100?issue_type=UnusedShapeId
- Archive publiée le 12/11/2026, couverture déclarée du 12/11/2026 au 27/12/2026.
- Rapport PAN de la ressource : 32 lignes, 1 238 points d'arrêt, 624 zones d'arrêt ; taille annoncée 3,26 Mo.
- Présence de `shapes.txt` ; absence des fichiers `fare_attributes.txt`, `fare_rules.txt`, `fare_products.txt`, `fare_media.txt`. **Aucun prix ne peut être déduit du GTFS seul**.
- Licence : ODbL et conditions particulières d'utilisation (à vérifier avant redistribution).
- Attention : certaines descriptions éditoriales de la page n'ont pas la même date que le fichier courant ; privilégier le calendrier réel contenu dans le ZIP après audit.

## 2. Agrégat Cars Auvergne-Rhône-Alpes
- Catalogue officiel PAN : https://transport.data.gouv.fr/datasets/offer/449?locale=fr&type=public-transit
- Agrégat des réseaux urbains et interurbains d'Auvergne-Rhône-Alpes, format GTFS.
- **Archive exacte, période de validité, licence et contenu non encore vérifiés** : ne pas marquer comme importé.

## 3. Règles avant intégration OTP2
1. Relever URL directe, licence, date, taille et SHA256 de chaque archive après téléchargement réel.
2. Exécuter `node scripts/otp-gtfs-audit.cjs <archive.zip>`.
3. Contrôler les calendriers pour les dates de mission et la cohérence des arrêts aux frontières.
4. Ne pas importer simultanément un agrégat régional et ses sous-réseaux sans vérifier les doublons de courses (`agency_id`, `route_id`, `trip_id`, horaires, arrêts).
5. Les lignes à la demande ne sont pas nécessairement réservables sans procédure ; ne pas les présenter comme des services disponibles instantanément.
6. Pour la fiche mission, garder les tarifs commerciaux non confirmés explicitement inconnus ; aucun prix fictif.

## État
- Catalogue Sibra : **vérifié** sur le PAN.
- Archive Sibra téléchargée et auditée : **non**.
- Catalogue agrégat AURA : **identifié** sur le PAN.
- ZIP AURA : **non vérifié**.
- Graphe OTP2 AURA–Suisse : **non construit**.
- Dépenses Cloud : **aucune nouvelle ressource créée**.
