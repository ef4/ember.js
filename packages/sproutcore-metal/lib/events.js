// ==========================================================================
// Project:  SproutCore Metal
// Copyright: ©2011 Strobe Inc. and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================
/*globals sc_assert */

require('sproutcore-metal/core');
require('sproutcore-metal/platform');
require('sproutcore-metal/utils');

var o_create = SC.platform.create;
var meta = SC.meta;
var guidFor = SC.guidFor;
var a_slice = Array.prototype.slice;

/** @private */
function objectFor(m, obj, writable) {
  var len = arguments.length,
      idx, keyName, ret;
  
  for(idx = 3; idx < len; idx++) {
    keyName = arguments[idx];
    ret = m[keyName];

    if (writable) {
      if (!ret) {
        ret = m[keyName] = { __scproto__: obj };
      } else if (ret.__scproto__ !== obj) {
        ret = m[keyName] = o_create(ret);
        ret.__scproto__ = obj;
      }
    } else if (!ret || ret.__scproto__ !== obj) {
      return undefined;
    }

    m = ret;
  }

  return ret;
}

/** @private */
function listenerSetFor(obj, eventName, target, writable) {
  return objectFor(meta(obj, writable), obj, writable, 'listeners', eventName, target);
}

/** @private */
var EV_SKIP = {
  __scproto__: true
};

/** @private */
function invokeEvents(targets, params) {
  var tguid, mguid, methods, info, method, target;

  for (tguid in targets) {
    if (EV_SKIP[tguid]) { continue; }
    methods = targets[tguid];

    for (mguid in methods) {
      if (EV_SKIP[mguid] || !(info=methods[mguid])) { continue; }
      method = info.method;
      target = info.target;

      // object
      if (!target) { target = params[0]; }

      if (typeof method === 'string') { method = target[method]; }

      if (info.xform) { info.xform(target, method, params); }
      else { method.apply(target, params); }
    }
  }
}

/** @private */
function addListener(obj, eventName, target, method, xform) {
  if (!method && typeof target === 'function') {
    method = target;
    target = null;
  }

  var set = listenerSetFor(obj, eventName, target, true),
      guid = guidFor(method), ret;

  if (!set[guid]) {
    set[guid] = {target: target, method: method, xform: xform};
  } else {
    // used by observers etc to map params
    set[guid].xform = xform;
  }

  if (obj && typeof obj.didAddListener === 'function') {
    obj.didAddListener(eventName, target, method);
  }

  // return true if this is the first listener.
  return ret;
}

/**
  @function
  @param {Object} obj The object to add the listener to
  @param {String} eventName
  @param {Object} [target] Target for the callback method
  @param {String|Function} method
  @returns true if its the first listener, false if others
*/
SC.addListener = addListener;


/** @private */
function removeListener(obj, eventName, target, method) {
  if (!method && typeof target === 'function') {
    method = target;
    target = null;
  }

  var set = listenerSetFor(obj, eventName, target, true),
      guid = guidFor(method);

  // can't delete since it might be inherited
  if (set && set[guid]) { set[guid] = null; }

  if (obj && typeof obj.didRemoveListener === 'function') {
    obj.didRemoveListener(eventName, target, method);
  }
}

/**
  @function
  @param {Object} obj The object to remove the listener for
  @param {String} eventName
  @param {Object} [target] Target for the callback method
  @param {String|Function} method
*/
SC.removeListener = removeListener;


/**
  @private

  Returns a list of currently watched events
*/
function watchedEvents(obj) {
  var listeners = meta(obj, false).listeners,
      ret = [], eventName;

  if (listeners) {
    for(eventName in listeners) {
      if (!EV_SKIP[eventName] && listeners[eventName]) {
        ret.push(eventName);
      }
    }
  }

  return ret;
}

/**
  @function
  @param {Object} obj
  @returns {Array} Array of watched events
*/
SC.watchedEvents = watchedEvents;


/** @private */
function sendEvent(obj, eventName) {
  // first give object a change to handle it
  if (obj && typeof obj.sendEvent === 'function') {
    obj.sendEvent.apply(obj, a_slice.call(arguments, 1));
  }

  var set = meta(obj, false).listeners;
  if (set && (set = set[eventName])) {
    invokeEvents(set, arguments);
    return true;
  }

  return false;
}

/**
  @function
  @param {Object} obj
  @param {String} eventName
  @returns true if event invoked, false otherwise
*/
SC.sendEvent = sendEvent;


/** @private */
function hasListeners(obj, eventName) {
  var targets = meta(obj, false).listeners,
      tguid, mguid, methods;

  if (targets) { targets = targets[eventName]; }
  if (!targets) { return false; }

  for (tguid in targets) {
    if (EV_SKIP[tguid] || !targets[tguid]) { continue; }
    methods = targets[tguid];
    for (mguid in methods) {
      if (EV_SKIP[mguid] || !methods[mguid]) { continue; }
      // stop as soon as we find a valid listener
      return true;
    }
  }

  // no listeners! might as well clean this up so it is faster later.
  var set = objectFor(meta(obj, true), obj, true, 'listeners');
  set[eventName] = null;

  return false;
}

/**
  @function
  @param {Object} obj
  @param {String} eventName
*/
SC.hasListeners = hasListeners;


/** @private */
function listenersFor(obj, eventName) {
  var targets = meta(obj, false).listeners,
      ret = [], tguid, mguid, methods, info;

  if (targets) { targets = targets[eventName]; }
  if (!targets) { return ret; }

  for (tguid in targets) {
    if (EV_SKIP[tguid] || !targets[tguid]) { continue; }
    methods = targets[tguid];
    for (mguid in methods) {
      if (EV_SKIP[mguid] || !methods[mguid]) { continue; }
      info = methods[mguid];
      ret.push([info.target, info.method]);
    }
  }

  return ret;
}

/**
  @function
*/
SC.listenersFor = listenersFor;
