// SANEF GPS plaza guard: GPS identifiers are not tariff station identifiers.
// Browser/Node compatible. No tariff values are assigned here.
(function(root,factory){
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.CPSanefGpsProtection=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const GPS_CODES=Object.freeze(['02A902615CD','02A902620CD','51A902605CD','60A900120CD','60A900125CD']);
  const blocked=new Set(GPS_CODES);
  const isBlocked=id=>typeof id==='string'&&blocked.has(id);
  const unknown=(label)=>({kind:'barriere',label,status:'INCONNU',amount:null,reason:'sanef_gps_tarif_non_prouve'});
  function protectEngine(engine){
    if(!engine||typeof engine.barriere!=='function'||typeof engine.trajet!=='function') throw new TypeError('Moteur de péages invalide');
    function barriere(id,classe,date){return isBlocked(id)?unknown(id):engine.barriere(id,classe,date);}
    function trajet(passages,classe,date){
      if(!Array.isArray(passages)) throw new TypeError('passages doit être un tableau');
      if(!passages.some(p=>p&&p.type==='barriere'&&(isBlocked(p.station)||isBlocked(p.group)))) return engine.trajet(passages,classe,date);
      const vus=new Set(),lignes=[];
      for(const p of passages){
        if(!p||p.type!=='barriere')continue;
        const g=p.group||p.station;
        const key=(p.passage!=null?'p'+p.passage:'g'+g)+'|'+g;
        if(vus.has(key))continue;
        vus.add(key);
        lignes.push(isBlocked(p.station)||isBlocked(p.group)?unknown(g):{kind:'barriere',label:g,...engine.barriere(g,classe,date)});
      }
      return {lignes,total:null,complet:false,status:'INCONNU',classe,date:date instanceof Date?date.toISOString().slice(0,10):String(date).slice(0,10),engine_version:engine.version,reason:'sanef_gps_tarif_non_prouve'};
    }
    return {...engine,barriere,trajet};
  }
  return {GPS_CODES,isBlocked,protectEngine};
});