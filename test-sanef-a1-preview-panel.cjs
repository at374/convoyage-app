'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'sanef-a1-preview-panel.js'),'utf8');
class Node{constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this.textContent='';}appendChild(x){this.children.push(x);return x;}setAttribute(k,v){this.attrs[k]=v;}}
const doc={createElement(tag){return new Node(tag,doc);}};
const root=new Node('div',doc);
const window={CPSanefA1Preview2026:{preview:async(request,cents)=>{assert.equal(request.previewExplicitlyRequested,true);assert.equal(cents,1850);return {status:'MODULATION_PREVIEW',priceCents:1850,modulatedPriceCents:2080,period:'rouge',certifiedForBilling:false};}}};
vm.runInNewContext(code,{window},{filename:'sanef-a1-preview-panel.js'});
(async()=>{
 let count=0;
 const panel=await window.CPSanefA1PreviewPanel.show(root,{origine:'CALAIS (péage de Setques)'},1850);
 assert.equal(root.children.length,1);count++;
 assert.equal(panel.children.length,4);count++;
 assert.match(panel.children[1].textContent,/18,50 €/);count++;
 assert.match(panel.children[2].textContent,/20,80 €/);count++;
 assert.match(panel.children[3].textContent,/Non validé pour la facturation/);count++;
 const fallback=window.CPSanefA1PreviewPanel.render(root,{status:'NORMAL_ONLY',priceCents:1850,modulatedPriceCents:null});
 assert.match(fallback.children[2].textContent,/non confirmée/);count++;
 assert.equal(fallback.children[1].textContent,'Tarif normal conservé : 18,50 €');count++;
 assert.throws(()=>window.CPSanefA1PreviewPanel.render(null,{}),/Container required/);count++;
 for(const bad of [
 {status:'MODULATION_PREVIEW',priceCents:1850,modulatedPriceCents:2080,period:'unknown',certifiedForBilling:false},
 {status:'MODULATION_PREVIEW',priceCents:1850,modulatedPriceCents:2080,period:'rouge',certifiedForBilling:true},
 {status:'MODULATION_PREVIEW',priceCents:1850,modulatedPriceCents:-1,period:'rouge',certifiedForBilling:false}
 ]){
  const invalid=window.CPSanefA1PreviewPanel.render(root,bad);
  assert.match(invalid.children[2].textContent,/non confirmée/);count++;
 }
 console.log('PASS '+count+' SANEF A1 preview panel assertions');
})().catch(e=>{console.error(e);process.exitCode=1;});
