/* SANEF A1 read-only preview panel: only created by an explicit user action.
 * The caller supplies an existing container and a verified normal toll.
 * Does not touch the billing engine or overwrite any existing UI field.
 */
(function(root){'use strict';
const euro=cents=>(cents/100).toFixed(2).replace('.',',')+' €';
function render(container,result){
 if(!container||typeof container.appendChild!=='function')throw new TypeError('Container required');
 const doc=container.ownerDocument;
 const panel=doc.createElement('section');panel.className='sanef-a1-preview';panel.setAttribute('aria-label','Aperçu SANEF A1 non applicable à la facturation');
 const heading=doc.createElement('strong');heading.textContent='SANEF A1 · Aperçu indicatif';panel.appendChild(heading);
 const normal=doc.createElement('p');normal.textContent='Tarif normal conservé : '+(Number.isSafeInteger(result.priceCents)?euro(result.priceCents):'non confirmé');panel.appendChild(normal);
 const detail=doc.createElement('p');
 detail.textContent=result.status==='MODULATION_PREVIEW'&&Number.isSafeInteger(result.modulatedPriceCents)
  ? 'Tarif '+(result.period==='rouge'?'rouge':'vert')+' indicatif : '+euro(result.modulatedPriceCents)
  : 'Modulation non confirmée — tarif normal uniquement';
 panel.appendChild(detail);
 const warning=doc.createElement('small');warning.textContent='Non validé pour la facturation. Vérifier la grille SANEF et l’heure exacte du passage.';panel.appendChild(warning);
 container.appendChild(panel);
 return panel;
}
async function show(container,request,normalCents){
 if(!root.CPSanefA1Preview2026)throw new Error('SANEF preview bridge unavailable');
 const result=await root.CPSanefA1Preview2026.preview({...request,previewExplicitlyRequested:true},normalCents);
 return render(container,result);
}
Object.defineProperty(root,'CPSanefA1PreviewPanel',{value:Object.freeze({render,show}),writable:false,configurable:false});
})(typeof window!=='undefined'?window:globalThis);
