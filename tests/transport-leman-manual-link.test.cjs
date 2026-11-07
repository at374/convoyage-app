const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Léman Pass official tariff link is user-triggered and sends no journey details',()=>{
 const app=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
 const begin=app.indexOf('      const lemanFareLink='),end=app.indexOf('      const localCards={};',begin);
 assert.ok(begin>=0&&end>begin);
 const sourcePanel={children:[],appendChild(element){this.children.push(element);}};
 const document={createElement(tag){return {tag,children:[],appendChild(element){this.children.push(element);}};},createTextNode(text){return {text};}};
 vm.runInNewContext(app.slice(begin,end),{document,sourcePanel});
 assert.equal(sourcePanel.children.length,1);
 const note=sourcePanel.children[0],link=note.children.find(x=>x.tag==='a');
 assert.equal(link.href,'https://www.lemanpass.com/tarifs/');
 assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
 assert.match(note.textContent,/Aucun tarif n’est récupéré automatiquement/);
});
