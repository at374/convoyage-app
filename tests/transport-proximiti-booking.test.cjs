const test=require('node:test');
const assert=require('node:assert/strict');
const {assess}=require('../transport-proximiti-booking.js');
const base={line:'460',boardingStopType:'systematic',alightingStopType:'systematic',
 guaranteedConnection:false,serviceConfirmed:true,stopsConfirmed:true,walkingConfirmed:true,marginConfirmed:true};
test('unknown stop types cannot be treated as confirmed',()=>{
 const x=assess({line:'460',serviceConfirmed:true});
 assert.equal(x.needsRegistration,null);assert.equal(x.ready,false);
});
test('systematic 460 stops do not automatically require booking',()=>{
 const x=assess(base);assert.equal(x.needsRegistration,false);assert.equal(x.ready,true);
});
test('460 on-demand stop requires explicit booking confirmation',()=>{
 const x=assess({...base,boardingStopType:'on_demand'});
 assert.equal(x.needsRegistration,true);assert.equal(x.ready,false);assert.equal(x.registrationDeadlineMinutes,120);
 assert.equal(assess({...base,boardingStopType:'on_demand',registrationConfirmed:true}).ready,false);
 assert.equal(assess({...base,boardingStopType:'on_demand',bookingAvailabilityVerified:true}).ready,false);
 assert.equal(assess({...base,boardingStopType:'on_demand',registrationConfirmed:true,bookingAvailabilityVerified:true}).ready,true);
});
test('461 guaranteed connection requires confirmation even at systematic stops',()=>{
 const x=assess({...base,line:'461',guaranteedConnection:true});
 assert.equal(x.registrationDeadlineMinutes,5);assert.equal(x.needsRegistration,true);assert.equal(x.ready,false);
});
test('no fare, schedule or availability is inferred from the published PDF',()=>{
 const x=assess({...base,walkingConfirmed:false});
 assert.equal(x.ready,false);assert.equal(x.bookingAvailabilityVerified,false);
 assert.equal(Object.hasOwn(x,'fareVerified'),false);
 assert.equal(assess({line:'462'}),null);
});

test('booking matrix: all 460/461 stop and connection combinations fail closed',()=>{
 for(const line of ['460','461']){
  for(const boardingStopType of ['systematic','on_demand','unknown']){
   for(const alightingStopType of ['systematic','on_demand','unknown']){
    for(const guaranteedConnection of [false,true,undefined]){
     const input={...base,line,boardingStopType,alightingStopType,guaranteedConnection};
     const result=assess(input);
     const known=boardingStopType!=='unknown'&&alightingStopType!=='unknown'&&
      typeof guaranteedConnection==='boolean';
     const required=known&&(boardingStopType==='on_demand'||alightingStopType==='on_demand'||guaranteedConnection);
     assert.equal(result.needsRegistration,known?required:null);
     assert.equal(result.ready,known&&!required);
     if(required){
      assert.equal(assess({...input,registrationConfirmed:true}).ready,false);
      assert.equal(assess({...input,bookingAvailabilityVerified:true}).ready,false);
      assert.equal(assess({...input,registrationConfirmed:true,bookingAvailabilityVerified:true}).ready,true);
     }
    }
   }
  }
 }
});
test('every operational proof is mandatory even when booking is confirmed',()=>{
 for(const key of ['serviceConfirmed','stopsConfirmed','walkingConfirmed','marginConfirmed']){
  const x=assess({...base,boardingStopType:'on_demand',registrationConfirmed:true,
   bookingAvailabilityVerified:true,[key]:false});
  assert.equal(x.ready,false,key);
 }
});
