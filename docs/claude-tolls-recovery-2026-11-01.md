# Reprise des vérifications historiques — 1er novembre 2026

Les fichiers historiques retrouvés sont LIRE_EN_PREMIER_TRANSMISSION_CLAUDE.md (20 octobre), LIVRAISON_161_GARES_CLAUDE_2026.csv et plusieurs audits par réseau. La transmission mentionne 16 918 relations déjà détenues et un bilan utilisateur de 156/161 lignes, non réconcilié par un export final. Ces unités ne représentent ni le nombre de gares physiques ni un certificat national.

L'historique du catalogue du 24 octobre précisait quatre relations SAPN vers Tancarville dont la classe 2 n'était pas retrouvée. La grille officielle actuelle, applicable au 1er février 2026, contient ces cellules :
 
| Relation vers TANCARVILLE (A131) | Classe 1 | Classe 2 |
|---|---:|---:|
| INCARVILLE N°19 / A154 | 5,80 € | 9,40 € |
| HEUDEBOUVILLE N°18 | 5,90 € | 9,40 € |
| CHAUFOUR N°15 à GAILLON N°17 | 7,90 € | 12,60 € |
| POISSY / ORGEVAL N°7 à MANTES-SUD N°12 | 10,90 € | 17,50 € |

Source : https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf, page 2 pour la classe 1 et page 3 pour la classe 2. L'extrait textuel du document officiel est archivé dans data/tolls/reviewed/sapn-a131-source-extract-2026.json. Les trois lignes Bourneville, Bourg-Achard et Criquebeuf, déjà reconnues à 3,40/5,50 euros dans le catalogue, identifient la colonne Tancarville sans sommer des tronçons.

La reprise de cet extrait a réussi sur GitHub, commit 0b8223d5ee68c4d96721f0d03d4cda9ecf56f286. Le reçu conserve son SHA-256 et les cellules lues. Le téléchargement brut du PDF depuis le runner GitHub a échoué HTTP 403 (run 41281014243); il n'est pas présenté comme réussi, et aucun hash du PDF n'est inventé. La vérification en direct demeure séparée du rejeu de l'extrait.

Les quatre paires sont ajoutées au catalogue sans modifier aucune ligne existante. Le nom publié Incarville N°19 / A154 est rattaché explicitement au libellé existant INCARVILLE N°19; le nom source reste conservé dans la preuve. Il ne s'agit pas d'une suppression générale des qualificatifs de route. Le pont de Tancarville, barrière séparée, n'est pas assimilé à la relation autoroutière A131.

Aucune distance tarifaire ne figure dans cette grille : le champ reste null et le calcul géométrique refuse d'utiliser ces paires pour fabriquer un total. Les prix sont retrouvés; la validation d'itinéraires complets est une autre étape.

Ce rattrapage clôt les quatre absences de classe 2 documentées dans cet historique. Il ne prouve pas une couverture actuelle à 100 % de toutes les autoroutes, ponts, tunnels, contextes horaires et frontières. Les 280 libellés non raccordés et 14 conflits précédemment recensés restent des problèmes distincts.


## Complementary facilities and conditional fares

Reviewed source records are in `data/tolls/reviewed/special-facilities-2026-11-01.json`. Prado Carenage's 3.30 EUR base passage is confirmed by the operator's regulated 2026 release; Prado Sud's 2.90 EUR remains a secondary-source candidate, not an imported official price. The Pont de Re operator publishes 4/8/16 EUR for classes 1/2 according to season, for a round trip; holiday exceptions and route identity remain to integrate. Schloesing is a specific free connection, not a blanket Prado tunnel exemption. These source findings do not imply Agenda or route integration.

The fixed-price engine previously accepted free-text conditions as unconditional. Such conditions now remain unresolved. ARCOS's four stored time-dependent prices therefore cannot be used with date-only context. Millau's second station identity now has structured winter and summer records (11.30/13.80 EUR class 1; 17.00/20.70 EUR class 2), matching the existing CEVM identity and the official 2026 page. No stored ARCOS amount is deleted and no time-dependent rate is guessed.
