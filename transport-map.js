/* In-app transport map. Only supplied stop coordinates and supplied shapes are drawn.
 * Missing geometry never becomes a straight-line route. No mission or key is sent.
 */
(function(root){
'use strict';
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon??p.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lon??p.lng)<=180;
const point=p=>valid(p)?{lat:p.lat,lon:p.lon??p.lng}:null;
function decode(encoded){
 if(typeof encoded!=='string'||encoded.length>200000)return [];
 let index=0,lat=0,lon=0;const result=[];
 try{while(index<encoded.length){const read=()=>{let value=0,shift=0,byte;do{if(index>=encoded.length||shift>30)throw Error('Invalid shape');byte=encoded.charCodeAt(index++)-63;if(byte<0||byte>63)throw Error('Invalid shape');value|=(byte&31)<<shift;shift+=5;}while(byte>=32);return value&1?~(value>>1):value>>1;};lat+=read();lon+=read();const p=point({lat:lat/1e5,lon:lon/1e5});if(!p)throw Error('Invalid shape');result.push(p);if(result.length>20000)throw Error('Too many points');}}catch(_){return [];}
 return result.length>=2?result:[];
}
function model(journey){
 const legs=Array.isArray(journey?.legs)?journey.legs:[];const stops=[],shapes=[];
 for(const [index,leg] of legs.entries()){
  if(!leg||typeof leg!=='object')continue;
  const from=point(leg.fromPoint),to=point(leg.toPoint);
  if(from)stops.push({...from,name:typeof leg.from==='string'?leg.from:'Départ',leg:index});
  if(to)stops.push({...to,name:typeof leg.to==='string'?leg.to:'Arrivée',leg:index});
  const supplied=Array.isArray(leg.geometry)?leg.geometry:decode(leg.encodedGeometry);
  const shape=supplied.length>=2&&supplied.length<=20000&&supplied.every(valid)?supplied.map(point):[];
  // A provider shape must connect the supplied endpoints; otherwise preserve stops only.
  const near=(a,b)=>Math.abs(a.lat-b.lat)<=0.001&&Math.abs(a.lon-b.lon)<=0.0015;
  if(shape.length&&from&&to&&near(shape[0],from)&&near(shape.at(-1),to)){
   const mode=String(leg.mode||'').toLowerCase();
   shapes.push({points:shape.filter((_,i)=>i%Math.max(1,Math.ceil(shape.length/500))===0||i===shape.length-1),
    kind:mode.includes('walk')||mode==='wa_wal'?'walk':mode.includes('rail')||mode.includes('train')||leg.provider==='SNCF'?'rail':'bus'});
  }
 }
 const unique=stops.filter((s,i)=>stops.findIndex(t=>t.lat===s.lat&&t.lon===s.lon&&t.name===s.name)===i);
 return {stops:unique,shapes,missingGeometry:shapes.length<legs.length};
}
function project(p,z){const n=256*2**z,s=Math.sin(p.lat*Math.PI/180);return [(p.lon+180)/360*n,(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*n];}
let sequence=0;
function mount(card,journey){
 const doc=card.ownerDocument||root.document,summary=card.querySelector('summary');if(!summary)return;
 const data=model(journey),id='cp-transport-map-'+(++sequence);
 const viewer=doc.createElement('div');viewer.className='cp-transport-viewer';
 const tabs=doc.createElement('div');tabs.className='cp-transport-map-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Présentation du trajet');
 const map=doc.createElement('div'),steps=doc.createElement('div');map.id=id+'-map';steps.id=id+'-steps';
 map.setAttribute('role','tabpanel');steps.setAttribute('role','tabpanel');
 for(const node of Array.from(card.children))if(node!==summary)steps.appendChild(node);
 const mapButton=doc.createElement('button'),stepsButton=doc.createElement('button');
 for(const [button,text,panel,key] of [[mapButton,'Carte',map,'map'],[stepsButton,'Étapes',steps,'steps']]){
  button.type='button';button.textContent=text;button.id=id+'-'+key+'-tab';button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',button.id);tabs.appendChild(button);
 }
 const notice=doc.createElement('p');notice.className='doux';
 notice.textContent=!data.stops.length?'Coordonnées des arrêts indisponibles pour ce trajet. Consulte les étapes.':data.missingGeometry?'Arrêts localisés. Les portions sans tracé fourni ne sont pas dessinées.':'Tracés fournis par la source ; circulation et accès à vérifier.';
 map.appendChild(notice);
 let zoom=13,center=null,origin=null,drawn=false,baseZoom=13,baseCenter=null;
 const canvas=doc.createElement('div');canvas.className='cp-transport-map';canvas.setAttribute('aria-label','Carte des arrêts et des tracés disponibles');
 const info=doc.createElement('p');info.className='cp-transport-map-stop';info.setAttribute('aria-live','polite');info.textContent='Touche un arrêt pour voir son nom.';
 const attribution=doc.createElement('a');attribution.href='https://www.openstreetmap.org/copyright';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.textContent='© OpenStreetMap';attribution.className='cp-transport-map-credit';
 const tiles=doc.createElement('div'),overlay=doc.createElementNS('http://www.w3.org/2000/svg','svg'),markers=doc.createElement('div');
 tiles.className='cp-transport-map-tiles';markers.className='cp-transport-map-markers';overlay.setAttribute('aria-hidden','true');
 canvas.append(tiles,overlay,markers,attribution);
 const width=()=>Math.max(240,Math.min(700,canvas.clientWidth||320)),height=300;
 function fit(){const all=data.stops.concat(data.shapes.flatMap(s=>s.points));if(!all.length)return;
  const low={lat:Math.min(...all.map(p=>p.lat)),lon:Math.min(...all.map(p=>p.lon))},high={lat:Math.max(...all.map(p=>p.lat)),lon:Math.max(...all.map(p=>p.lon))};
  zoom=16;while(zoom>2){const a=project(low,zoom),b=project(high,zoom);if(Math.abs(a[0]-b[0])<width()-60&&Math.abs(a[1]-b[1])<height-60)break;zoom--;}
  center={lat:(low.lat+high.lat)/2,lon:(low.lon+high.lon)/2};baseZoom=zoom;baseCenter={...center};origin=null;
 }
 function draw(){if(!card.open||map.hidden||!data.stops.length||!canvas.isConnected)return;
  if(!center)fit();const w=width(),n=2**zoom,p=origin||project(center,zoom),ox=p[0]-w/2,oy=p[1]-height/2;
  tiles.replaceChildren();markers.replaceChildren();overlay.replaceChildren();overlay.setAttribute('viewBox','0 0 '+w+' '+height);
  for(let x=Math.floor(ox/256);x<=Math.floor((ox+w)/256);x++)for(let y=Math.floor(oy/256);y<=Math.floor((oy+height)/256);y++)if(y>=0&&y<n){
   const tile=doc.createElement('img');tile.alt='';tile.referrerPolicy='strict-origin-when-cross-origin';tile.draggable=false;tile.src='https://tile.openstreetmap.org/'+zoom+'/'+((x%n+n)%n)+'/'+y+'.png';
   tile.style.cssText='left:'+(x*256-ox)+'px;top:'+(y*256-oy)+'px';tile.onerror=()=>{notice.textContent='Fond de carte indisponible. Les positions et les étapes restent consultables.';};tiles.appendChild(tile);
  }
  const colors={walk:'#e5a52c',bus:'#328de6',rail:'#bb6eed'};
  for(const shape of data.shapes){const line=doc.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',shape.points.map(q=>{const v=project(q,zoom);return (v[0]-ox)+','+(v[1]-oy);}).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',colors[shape.kind]);line.setAttribute('stroke-width','5');if(shape.kind==='walk')line.setAttribute('stroke-dasharray','7 5');overlay.appendChild(line);}
  const groups=[];
  data.stops.forEach((stop,i)=>{const p=project(stop,zoom),group=groups.find(g=>Math.hypot(g.p[0]-p[0],g.p[1]-p[1])<44);if(group)group.items.push({stop,index:i});else groups.push({p,items:[{stop,index:i}]});});
  for(const group of groups){const button=doc.createElement('button'),first=group.items[0];button.type='button';button.className='cp-transport-map-marker';button.textContent=String(first.index+1)+(group.items.length>1?'+'+(group.items.length-1):'');button.setAttribute('aria-label',group.items.map(item=>item.stop.name).join(' · '));button.style.cssText='left:'+(group.p[0]-ox)+'px;top:'+(group.p[1]-oy)+'px';button.onclick=()=>{info.textContent=group.items.map(item=>(item.index+1)+'. '+item.stop.name).join(' · ');};markers.appendChild(button);}
  drawn=true;
 }
 if(data.stops.length){
  const controls=doc.createElement('div');controls.className='cp-transport-map-controls';
  for(const [label,action] of [['Agrandir',()=>{zoom=Math.min(18,zoom+1);origin=null;draw();}],['Réduire',()=>{zoom=Math.max(2,zoom-1);origin=null;draw();}],['Recentrer',()=>{zoom=baseZoom;center={...baseCenter};origin=null;draw();}]]){const b=doc.createElement('button');b.type='button';b.textContent=label;b.onclick=action;controls.appendChild(b);}
  const stopLabel=doc.createElement('label');stopLabel.textContent='Choisir un arrêt';
  const stopSelect=doc.createElement('select');stopSelect.setAttribute('aria-label','Choisir un arrêt sur la carte');
  const placeholder=doc.createElement('option');placeholder.value='';placeholder.textContent='Tous les arrêts';stopSelect.appendChild(placeholder);
  data.stops.forEach((stop,i)=>{const option=doc.createElement('option');option.value=String(i);option.textContent=(i+1)+'. '+stop.name;stopSelect.appendChild(option);});
  stopSelect.onchange=()=>{if(stopSelect.value===''){fit();draw();return;}const i=Number(stopSelect.value),stop=data.stops[i];if(!stop)return;center={lat:stop.lat,lon:stop.lon};zoom=17;origin=null;info.textContent=(i+1)+'. '+stop.name;draw();};
  stopLabel.appendChild(stopSelect);map.append(controls,canvas,info,stopLabel);
  const legend=doc.createElement('p');legend.className='cp-transport-map-legend';legend.textContent='Marche : pointillés dorés · Bus : bleu · Train : violet';map.appendChild(legend);
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{if(e.target.closest('button,a'))return;drag={x:e.clientX,y:e.clientY,p:origin||project(center,zoom)};canvas.setPointerCapture?.(e.pointerId);});
  canvas.addEventListener('pointerup',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;const p=[drag.p[0]-dx,drag.p[1]-dy],n=256*2**zoom;center={lon:p[0]/n*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*p[1]/n)))*180/Math.PI};origin=p;drag=null;draw();});
  canvas.addEventListener('pointercancel',()=>{drag=null;});
 }
 function select(isMap){map.hidden=!isMap;steps.hidden=isMap;mapButton.setAttribute('aria-selected',String(isMap));stepsButton.setAttribute('aria-selected',String(!isMap));if(isMap)draw();}
 mapButton.onclick=()=>select(true);stepsButton.onclick=()=>select(false);
 viewer.append(tabs,map,steps);card.appendChild(viewer);
 card.addEventListener('toggle',()=>{if(card.open){if(!drawn)fit();draw();}});
 select(true);return {data};
}
const api={model,decode,project,mount};if(typeof module==='object'&&module.exports)module.exports=api;root.CPTransportMap=api;
})(typeof window!=='undefined'?window:globalThis);
