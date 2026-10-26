// Convoyage Ultra — recherche de correspondances à partir de trajets datés.
// Module pur : aucune requête réseau, aucun tarif ni horaire fabriqué.
(function(root){
'use strict';
const ms = v => Date.parse(v);
function correspondances(trajets, options={}){
  // Refuser les bornes horaires invalides au lieu de les ignorer.
  if ((options.arriveeAvant != null && !Number.isFinite(ms(options.arriveeAvant))) ||
      (options.departApres != null && !Number.isFinite(ms(options.departApres)))) return [];
  const minimumSaisi = options.minimumMinutes == null ? 8 : Number(options.minimumMinutes);
  if (!Number.isFinite(minimumSaisi) || minimumSaisi < 0) return [];
  const minimum = Math.min(120, minimumSaisi)*60000;
  const maximumSaisi = options.maximumMinutes == null ? 90 : Number(options.maximumMinutes);
  if (!Number.isFinite(maximumSaisi) || maximumSaisi < 0) return [];
  const maximum = Math.max(minimum, Math.min(360, maximumSaisi)*60000);
  const limiteSaisie = options.limite == null ? 30 : Number(options.limite);
  if (!Number.isFinite(limiteSaisie) || limiteSaisie < 1) return [];
  const limite = Math.max(1, Math.min(200, Math.floor(limiteSaisie)));
  const normalises = (Array.isArray(trajets)?trajets:[]).filter(t=>
    t && t.departArret && t.arriveeArret &&
    typeof t.departAt === 'string' && /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(t.departAt) &&
    typeof t.arriveeAt === 'string' && /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(t.arriveeAt) &&
    Number.isFinite(ms(t.departAt)) && Number.isFinite(ms(t.arriveeAt)) &&
    ms(t.arriveeAt)>ms(t.departAt));
  const cle = s=>String(s).trim().toLocaleLowerCase('fr-FR');
  const identifiant = v => String(v).trim();
  const cleArret = (reseau, id) => 'id:' + reseau + ':' + identifiant(id);
  // Indexation des arrêts par identifiant officiel lorsqu'il existe.
  // Sinon, le nom reste un rapprochement indicatif.
  // Les identifiants d'arrêt ne sont uniques qu'à l'intérieur d'un réseau.
  // Deux réseaux peuvent tous deux utiliser "1234" pour des lieux différents.
  const espace = t => cle(t.reseau || t.networkId || t.agence || t.fournisseur || '');
  // Sans espace réseau connu, l'identifiant local n'est pas assez fiable
  // pour établir une correspondance entre deux fournisseurs.
  const arretFiable = (t, id) => id != null && identifiant(id) !== '' && espace(t) !== '';
  const arretDepart = t => arretFiable(t,t.departStopId)
    ? cleArret(espace(t), t.departStopId)
    : 'nom:' + cle(t.departArret);
  const arretArrivee = t => arretFiable(t,t.arriveeStopId)
    ? cleArret(espace(t), t.arriveeStopId)
    : 'nom:' + cle(t.arriveeArret);
  // Les équivalences interréseaux ne sont acceptées que si une table
  // explicite a été fournie (ex. deux quais vérifiés d'une même gare).
  // Aucun rapprochement géographique approximatif n'est inventé.
  const equivalences = new Map();
  // Pour chaque transfert explicitement vérifié, la marche réelle peut
  // nécessiter un délai supérieur au minimum global.
  const tempsTransfert = new Map();
  for (const regle of Array.isArray(options.transfertsVerifies) ? options.transfertsVerifies : []) {
    if (!regle || typeof regle.de !== 'string' || typeof regle.vers !== 'string' ||
        !regle.de.startsWith('id:') || !regle.vers.startsWith('id:')) continue;
    const minutes = Number(regle.minutes);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) continue;
    if (!equivalences.has(regle.de)) equivalences.set(regle.de, new Set());
    equivalences.get(regle.de).add(regle.vers);
    tempsTransfert.set(regle.de + '>' + regle.vers, minutes * 60000);
  }
  for (const groupe of Array.isArray(options.equivalencesArrets) ? options.equivalencesArrets : []) {
    if (!Array.isArray(groupe) || groupe.length < 2) continue;
    const ids = [...new Set(groupe.filter(v => typeof v === 'string' && /^id:[^:]+:.+/.test(v)))];
    for (const id of ids) {
      if (!equivalences.has(id)) equivalences.set(id, new Set());
      for (const autre of ids) if (autre !== id) equivalences.get(id).add(autre);
    }
  }
  // Un trajet demandé ne doit pas être confondu avec une correspondance
  // quelconque présente dans la réponse du fournisseur.
  const cleDemandee = v => typeof v === 'string' && /^(id:[^:]+:.+|nom:.+)$/.test(v) ? v : null;
  const origineDemandee = cleDemandee(options.origineStopKey);
  const destinationDemandee = cleDemandee(options.destinationStopKey);
  // Une contrainte invalide ne doit jamais élargir silencieusement la recherche.
  if ((options.origineStopKey != null && !origineDemandee) ||
      (options.destinationStopKey != null && !destinationDemandee)) return [];
  const parDepart = new Map();
  for(const t of normalises){
    const k=arretDepart(t);
    if(!parDepart.has(k)) parDepart.set(k,[]);
    parDepart.get(k).push(t);
  }
  for(const lignes of parDepart.values()) lignes.sort((a,b)=>ms(a.departAt)-ms(b.departAt));
  // Évite les itinéraires à deux segments qui reviennent au point de départ
  // ou qui inversent la progression du voyage.
  const memeArret = (a,b) => a === b && Boolean(a);
  const departInitial = t => arretDepart(t);
  const arriveeFinale = t => arretArrivee(t);
  const resultats=[];
  for(const premier of normalises){
    if (origineDemandee && arretDepart(premier) !== origineDemandee) continue;
    const arrivee = arretArrivee(premier);
    const cibles = [...new Set([arrivee, ...(equivalences.get(arrivee) || [])])];
    for(const second of cibles.flatMap(id => parDepart.get(id) || [])){
      if (destinationDemandee && arretArrivee(second) !== destinationDemandee) continue;
      const attente=ms(second.departAt)-ms(premier.arriveeAt);
      const marche = tempsTransfert.get(arrivee + '>' + arretDepart(second)) || 0;
      // L'équivalence seule n'atteste pas d'un temps de marche nul.
      // Les transferts sans durée vérifiée restent indicatifs.
      if(attente<Math.max(minimum,marche) || attente>maximum) continue;
      // Si une marche est connue, elle doit laisser au moins la marge
      // minimale de changement demandée, en plus du déplacement à pied.
      if(marche && attente < marche + minimum) continue;
      if(premier===second || (premier.tripId && premier.tripId===second.tripId &&
          espace(premier)===espace(second))) continue;
      if (memeArret(departInitial(premier), arriveeFinale(second))) continue;
      if (memeArret(departInitial(premier), arretArrivee(premier)) ||
          memeArret(arretDepart(second), arriveeFinale(second))) continue;
      // Sans identité d'arrêt stable, un même nom peut désigner deux quais
      // éloignés : ne jamais annoncer la correspondance comme garantie.
      if (premier.arriveeStopId && second.departStopId &&
          arretArrivee(premier) !== arretDepart(second) &&
          !(equivalences.get(arretArrivee(premier)) || new Set()).has(arretDepart(second))) continue;
      if(options.arriveeAvant && ms(second.arriveeAt)>ms(options.arriveeAvant)) continue;
      if(options.departApres && ms(premier.departAt)<ms(options.departApres)) continue;
      // L'égalité de nom d'arrêt ne garantit pas un quai accessible.
      // Toute correspondance reste à vérifier auprès du transporteur.
      resultats.push({
        departAt:premier.departAt,arriveeAt:second.arriveeAt,
        correspondanceArret:premier.arriveeArret,
        attenteMinutes:Math.round(attente/60000),
        segments:[premier,second],correspondanceConfirmee:false,
        marcheMinutes: tempsTransfert.has(arrivee + '>' + arretDepart(second))
          ? marche / 60000 : null,
        transfertVerifie: tempsTransfert.has(arrivee + '>' + arretDepart(second)),
        prixEUR:null,source:'',confirme:false
      });
    }
  }
  return resultats.sort((a,b)=>ms(a.arriveeAt)-ms(b.arriveeAt)||ms(a.departAt)-ms(b.departAt)).slice(0,limite);
}
const api={correspondances};
root.CPCorrespondancesTransport=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
