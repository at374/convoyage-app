// Convoyage Ultra — recherche de correspondances à partir de trajets datés.
// Module pur : aucune requête réseau, aucun tarif ni horaire fabriqué.
(function(root){
'use strict';
const ms = v => Date.parse(v);
function correspondances(trajets, options={}){
  const minimumSaisi = Number(options.minimumMinutes);
  const minimum = Math.max(0, Math.min(120, Number.isFinite(minimumSaisi) ? minimumSaisi : 8))*60000;
  const maximum = Math.max(minimum, Math.min(360, Number(options.maximumMinutes) || 90)*60000);
  const limite = Math.max(1, Math.min(200, Number(options.limite) || 30));
  const normalises = (Array.isArray(trajets)?trajets:[]).filter(t=>
    t && t.departArret && t.arriveeArret &&
    Number.isFinite(ms(t.departAt)) && Number.isFinite(ms(t.arriveeAt)) &&
    ms(t.arriveeAt)>ms(t.departAt));
  const cle = s=>String(s).trim().toLocaleLowerCase('fr-FR');
  // Indexation des arrêts par identifiant officiel lorsqu'il existe.
  // Sinon, le nom reste un rapprochement indicatif.
  // Les identifiants d'arrêt ne sont uniques qu'à l'intérieur d'un réseau.
  // Deux réseaux peuvent tous deux utiliser "1234" pour des lieux différents.
  const espace = t => cle(t.reseau || t.networkId || t.agence || t.fournisseur || '');
  const arretDepart = t => t.departStopId
    ? 'id:' + espace(t) + ':' + String(t.departStopId)
    : 'nom:' + cle(t.departArret);
  const arretArrivee = t => t.arriveeStopId
    ? 'id:' + espace(t) + ':' + String(t.arriveeStopId)
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
  const parDepart = new Map();
  for(const t of normalises){
    const k=arretDepart(t);
    if(!parDepart.has(k)) parDepart.set(k,[]);
    parDepart.get(k).push(t);
  }
  for(const lignes of parDepart.values()) lignes.sort((a,b)=>ms(a.departAt)-ms(b.departAt));
  const resultats=[];
  for(const premier of normalises){
    const arrivee = arretArrivee(premier);
    const cibles = [arrivee, ...(equivalences.get(arrivee) || [])];
    for(const second of cibles.flatMap(id => parDepart.get(id) || [])){
      const attente=ms(second.departAt)-ms(premier.arriveeAt);
      const marche = tempsTransfert.get(arrivee + '>' + arretDepart(second)) || 0;
      if(attente<Math.max(minimum,marche) || attente>maximum) continue;
      // Si une marche est connue, elle doit laisser au moins la marge
      // minimale de changement demandée, en plus du déplacement à pied.
      if(marche && attente < marche + minimum) continue;
      if(premier===second || (premier.tripId && premier.tripId===second.tripId)) continue;
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
