'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assessJourney} = require('../transport-walking.js');

const row = {
  departure: '2026-11-04T09:00:00+01:00',
  arrival: '2026-11-04T10:00:00+01:00',
  originStop: {lat:45.9,lon:6.1},
  destinationStop: {lat:45.91,lon:6.11}
};
const task = {
  from: {lat:45.9,lon:6.1},
  to: {lat:45.91,lon:6.11},
  earliestDeparture: '2026-11-04T08:00:00+01:00',
  latestArrival: '2026-11-04T10:30:00+01:00',
  marginMinutes: 15
};
test('missing journey inputs fail closed without throwing', () => {
  for (const [journey,mission,walks] of [
    [null,task,{}],[undefined,task,{}],[row,null,{}],
    [row,undefined,{}],[row,task,null],[row,task,undefined],
    [false,task,{}],[row,false,{}],[row,task,false]
  ]) {
    const result=assessJourney(journey,mission,walks);
    assert.equal(result.status,'unknown');
    assert.equal(result.realizable,false);
    assert.equal(result.serviceConfirmed,false);
    assert.equal(result.accessVerified,false);
    assert.equal(result.transferVerified,false);
  }
});
test('valid mission with missing pedestrian paths remains unconfirmed', () => {
  const result=assessJourney(row,task,{});
  assert.equal(result.realizable,false);
  assert.equal(result.status,'partial');
  assert.equal(result.doorDeparture,null);
  assert.equal(result.doorArrival,null);
});
