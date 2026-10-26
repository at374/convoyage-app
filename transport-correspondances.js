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
  const parDepart = new Map();
  for(const t of normalises){
    const k=cle(t.departArret);
    if(!parDepart.has(k)) parDepart.set(k,[]);
    parDepart.get(k).push(t);
  }
  for(const lignes of parDepart.values()) lignes.sort((a,b)=>ms(a.departAt)-ms(b.departAt));
  const resultats=[];
  for(const premier of normalises){
    for(const second of parDepart.get(cle(premier.arriveeArret))||[]){
      const attente=ms(second.departAt)-ms(premier.arriveeAt);
      if(attente<minimum || attente>maximum) continue;
      if(premier===second || (premier.tripId && premier.tripId===second.tripId)) continue;
      // Sans identité d'arrêt stable, un même nom peut désigner deux quais
      // éloignés : ne jamais annoncer la correspondance comme garantie.
      if (premier.arriveeStopId && second.departStopId &&
          premier.arriveeStopId !== second.departStopId) continue;
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
