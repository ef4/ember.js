import { testBoth } from 'ember-metal/tests/props_helper';
import CoreObserver from 'ember-metal/core_observer';
import { computed } from 'ember-metal/computed';
import alias from 'ember-metal/alias';
import EmberObject from 'ember-runtime/system/object';

QUnit.module('Core Observer');

testBoth('should notice when property is modified', function(get, set) {
  expect(2);
  var obj = {};

  let observer = new CoreObserver(obj, 'foo', null, function(firedObj, key) {
    equal(firedObj, obj, 'observer should get the right obj');
    equal(key, 'foo', 'observer should get the right key');
  });

  set(obj, 'foo', 42);
  observer.check();
});

testBoth('should fire only once', function(get, set) {
  var count = 0;
  var obj = {};

  let observer = new CoreObserver(obj, 'foo', null, function(firedObj, key) {
    count++;
  });

  set(obj, 'foo', 42);
  observer.check();
  observer.check();
  equal(count, 1, 'expected observer to fire once');
});

testBoth('should follow chains', function(get, set) {
  var count = 0;
  var obj = {};

  var intermediateA = { is: 'a' };
  var intermediateB = { is: 'b' };

  set(intermediateA, 'foo', 1);
  set(intermediateB, 'foo', 1);

  let observer = new CoreObserver(obj, 'bar.foo', null, function(firedObj, key) {
    count++;
  });

  set(obj, 'bar', intermediateA);
  observer.check();
  equal(count, 1, 'expected observer to fire once');

  set(obj, 'bar', intermediateB);
  observer.check();
  equal(count, 2, 'expected observer to have fired twice');

  set(obj, 'bar', intermediateA);
  observer.check();
  equal(count, 3, 'expected observer to have fired three times');
});

testBoth('should fire for CP dependent key', function(get, set) {
  var count = 0;
  let obj = EmberObject.extend({
    foo: computed('bar', function() { return 1; })
  }).create();

  let observer = new CoreObserver(obj, 'foo', null, function() {
    count++;
  });

  set(obj, 'bar', 1);
  observer.check();
  equal(count, 1);

  set(obj, 'bar', 2);
  observer.check();
  equal(count, 2);
});

testBoth('should fire for intermediate CP dependent key ', function(get, set) {
  var count = 0;
  let obj = EmberObject.extend({
    foo: computed('bar', function() {
      return { baz: 1 };
    })
  }).create();

  let observer = new CoreObserver(obj, 'foo.baz', null, function() {
    count++;
  });

  set(obj, 'bar', 1);
  observer.check();
  equal(count, 1);

  set(obj, 'bar', 2);
  observer.check();
  equal(count, 2);
});

testBoth('should fire for alias', function(get, set) {
  var count = 0;
  let obj = EmberObject.extend({
    foo: alias('bar')
  }).create();

  let observer = new CoreObserver(obj, 'foo', null, function() {
    count++;
  });

  set(obj, 'bar', 1);
  observer.check();
  equal(count, 1);

  set(obj, 'bar', 2);
  observer.check();
  equal(count, 2);

  set(obj, 'foo', 3);
  observer.check();
  equal(count, 3);
});

testBoth('dependent key firing should not trigger re-evaluation', function(get, set) {
  var fireCount = 0;
  var evalCount = 0;
  let obj = EmberObject.extend({
    foo: computed('bar', function() {
      evalCount++;
      return 1;
    })
  }).create();

  let observer = new CoreObserver(obj, 'foo', null, function() {
    fireCount++;
  });

  set(obj, 'bar', 1);
  observer.check();
  equal(fireCount, 1);
  equal(evalCount, 0);

  set(obj, 'bar', 2);
  observer.check();
  equal(fireCount, 2);
  equal(evalCount, 0);

  set(obj, 'foo', 3);
  observer.check();
  equal(fireCount, 3);
  equal(evalCount, 0);
});
