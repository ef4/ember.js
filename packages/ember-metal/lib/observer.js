import {
  watch,
  unwatch
} from 'ember-metal/watching';
import {
  listenersFor,
  addListener,
  removeListener,
  suspendListeners,
  suspendListener
} from 'ember-metal/events';
import run from 'ember-metal/run_loop';
import Observer from 'ember-metal/core_observer';

/**
@module ember-metal
*/

var AFTER_OBSERVERS = ':change';
var BEFORE_OBSERVERS = ':before';

function changeEvent(keyName) {
  return keyName + AFTER_OBSERVERS;
}

function beforeEvent(keyName) {
  return keyName + BEFORE_OBSERVERS;
}

var observers = [];
window.o = observers;

/**
  @method addObserver
  @for Ember
  @param obj
  @param {String} _path
  @param {Object|Function} target
  @param {Function|String} [method]
  @public
*/
export function addObserver(obj, _path, target, method) {
  observers.push(new Observer(obj, _path, target, method));
  watch(obj, _path);

  return this;
}

function checkObservers() {
  for (let i = 0; i < observers.length; i++) {
    observers[i].check();
  }
}

export function scheduleCheckObservers() {
  if (observers.length > 0) {
    run.scheduleOnce('actions', checkObservers);
  }
}

export function observersFor(obj, path) {
  return listenersFor(obj, changeEvent(path));
}

/**
  @method removeObserver
  @for Ember
  @param obj
  @param {String} path
  @param {Object|Function} target
  @param {Function|String} [method]
  @public
*/
export function removeObserver(obj, path, target, method) {
  unwatch(obj, path);

  for (let i = 0; i < observers.length; i++) {
    let o = observers[i];
    if (o.obj === obj && o.path === path && o.target === target && o.method === method) {
      observers.splice(i, 1);
      break;
    }
  }
  return this;
}

/**
  @method _addBeforeObserver
  @for Ember
  @param obj
  @param {String} path
  @param {Object|Function} target
  @param {Function|String} [method]
  @deprecated
  @private
*/
export function _addBeforeObserver(obj, path, target, method) {
  addListener(obj, beforeEvent(path), target, method);
  watch(obj, path);

  return this;
}

// Suspend observer during callback.
//
// This should only be used by the target of the observer
// while it is setting the observed path.
export function _suspendObserver(obj, path, target, method, callback) {
  return suspendListener(obj, changeEvent(path), target, method, callback);
}

export function _suspendObservers(obj, paths, target, method, callback) {
  var events = paths.map(changeEvent);
  return suspendListeners(obj, events, target, method, callback);
}

/**
  @method removeBeforeObserver
  @for Ember
  @param obj
  @param {String} path
  @param {Object|Function} target
  @param {Function|String} [method]
  @deprecated
  @private
*/
export function _removeBeforeObserver(obj, path, target, method) {
  unwatch(obj, path);
  removeListener(obj, beforeEvent(path), target, method);

  return this;
}
