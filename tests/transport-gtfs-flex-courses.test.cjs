'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../transport-gtfs-index.js');
const F=require('../transport-gtfs-flex-courses.js');
const files={
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon\nA,Arrêt A,45.9,6.1\nB,Arrêt B,45.8,6.2\nC,Arrêt C,45.7,6.3\n',
 'routes.txt':'route_id,route_short_name,route_long_name,route_type\nR,TAD,Navette Flex,3\n',
 'trips.txt':'route_id,service_id,trip_id\nR,W,T1\n',
 'calendar.txt':'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nW,1,1,1,1,1,1,1,20260101,20271231\n',
 'location_group_stops.txt':'location_group_id,stop_id\nZ,A\nZ,C\n',
 'booking_rules.txt':'booking_rule_id,prior_notice_duration_min,booking_method,booking_url\nP,60,2,https://example.org/book\n',
 'stop_times.txt':'trip_id,stop_sequence,stop_id,location_group_id,start_pickup_drop_off_window,end_pickup_drop_off_window,pickup_type,drop_off_type,pickup_booking_rule_id,drop_off_booking_rule_id\nT1,1,,Z,08:00:00,09:00:00,2,1,P,\nT1,2,B,,09:15:00,10:00:00,1,2,,\n'
};
test('GTFS-Flex: one course contains its own windows/rules, never a fixed departure',()=>{
 const [c]=F.extract(files,G.buildIndex(files),'2026-11-23');
 assert.ok(c);assert.deepEqual(c.fromStopIds,['A','C']);assert.deepEqual(c.toStopIds,['B']);
 assert.equal(c.flexBooking.noticeMinutes,60);assert.equal(c.pickupWindow.startSeconds,28800);
 assert.equal(c.flexBooking.reservationConfirmed,false);assert.equal(c.journeyConfirmed,false);
 assert.equal(c.departure,undefined);assert.equal(c.priceStatus,'unknown');
});
test('Missing booking notice is unknown rather than zero',()=>{
 const f={...files,'booking_rules.txt':'booking_rule_id,prior_notice_duration_min\nP,\n'};
 const [c]=F.extract(f,G.buildIndex(f),'2026-11-23');assert.equal(c.flexBooking.noticeMinutes,null);
});
test('Submitted, unmatched and partially confirmed bookings cannot become confirmed',()=>{
 const [c]=F.extract(files,G.buildIndex(files),'2026-11-23');
 const b={tripId:'T1',date:'2026-11-23',fromStopId:'A',toStopId:'B',requestedPickup:'2026-11-23T08:30:00+01:00'};
 assert.equal(F.attachBooking(c,{...b,reservationConfirmed:false,pickupTimeConfirmed:true}).flexBooking.reservationConfirmed,false);
 assert.equal(F.attachBooking(c,{...b,fromStopId:'X',reservationConfirmed:true,pickupTimeConfirmed:true}).flexBooking.reservationConfirmed,false);
 assert.equal(F.attachBooking(c,{...b,reservationConfirmed:true,pickupTimeConfirmed:false}).flexBooking.reservationConfirmed,false);
 const approved=F.attachBooking(c,{...b,reservationConfirmed:true,pickupTimeConfirmed:true});
 assert.equal(approved.flexBooking.reservationConfirmed,true);
 assert.equal(approved.journeyConfirmed,false);
});
test('Inactive date has no TAD course',()=>{
 assert.deepEqual(F.extract(files,G.buildIndex(files),'2028-01-01'),[]);
});
