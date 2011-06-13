// ==========================================================================
// Project:  SproutCore Metal
// Copyright: ©2011 Strobe Inc. and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================
/*globals sc_assert */

require('sproutcore-metal/core');
require('sproutcore-metal/platform');
require('sproutcore-metal/utils');
require('sproutcore-metal/properties');

var a_slice = Array.prototype.slice;
var guidFor = SC.guidFor;
var meta = SC.meta;
var o_create = SC.platform.create;
var o_defineProperty = SC.platform.defineProperty;
var USE_ACCESSORS = SC.USE_ACCESSORS;


// ..........................................................
// DEPENDENT KEYS
// 

// data structure:
//  meta.deps = { 
//   'depKey': { 
//     'keyName': count,
//     __scproto__: SRC_OBJ [to detect clones]
//     },
//   __scproto__: SRC_OBJ
//  }

/** @private */
function uniqDeps(obj, depKey) {
  var m = meta(obj), deps, ret;
  deps = m.deps;

  if (!deps) {
    deps = m.deps = { __scproto__: obj };
  } else if (deps.__scproto__ !== obj) {
    deps = m.deps = o_create(deps);
    deps.__scproto__ = obj;
  }

  ret = deps[depKey];
  if (!ret) {
    ret = deps[depKey] = { __scproto__: obj };
  } else if (ret.__scproto__ !== obj) {
    ret = deps[depKey] = o_create(ret);
    ret.__scproto__ = obj;
  }

  return ret;
}

/** @private */
function addDependentKey(obj, keyName, depKey) {
  var deps = uniqDeps(obj, depKey);
  deps[keyName] = (deps[keyName] || 0) + 1;
  SC.watch(obj, depKey);
}

/** @private */
function removeDependentKey(obj, keyName, depKey) {
  var deps = uniqDeps(obj, depKey);
  deps[keyName] = (deps[keyName] || 0) - 1;
  SC.unwatch(obj, depKey);
}

/** @private */
function addDependentKeys(desc, obj, keyName) {
  var keys = desc._dependentKeys,
      len = keys ? keys.length : 0,
      idx;

  for(idx = 0; idx < len; idx++) {
    addDependentKey(obj, keyName, keys[idx]);
  }
}


// ..........................................................
// COMPUTED PROPERTY
//

/** @private */
function ComputedProperty(func, opts) {
  this.func = func;
  this._cacheable = opts && opts.cacheable;
  this._dependentKeys = opts && opts.dependentKeys;
}

/**
  @class

  Creates a computed property on an object. Normally,
  you create computed properties using the SC.computed()
  helper. If ENV.EXTEND_PROTOTYPES is true, you can simply
  call the .property() and .cacheable() helpers on function,
  as in the second example.

  ## Examples

      MyObject = SC.Object.extend({
        spanishHello: SC.computed(function() {
          return "Hola";
        }).property('here', 'there'),

        englishHello: function() {
          return "Hello";
        }.property('here', 'there').cacheable()
      });
*/
SC.ComputedProperty = ComputedProperty;
ComputedProperty.prototype = new SC.Descriptor();

var CP_DESC = {
  configurable: true,
  enumerable: true,
  /**
    @private
    For when use_accessors is false.
  */
  get: function() { return undefined; },
  /**
    @private
    For when use_accessors is false
  */
  set: SC.Descriptor.MUST_USE_SETTER
};

/** @private */
function mkCpGetter(keyName, desc) {
  var cacheable = desc._cacheable,
      func = desc.func;

  if (cacheable) {
    return function() {
      var ret, cache = meta(this).cache;
      if (keyName in cache) { return cache[keyName]; }
      ret = cache[keyName] = func.call(this, keyName);
      return ret;
    };
  } else {
    return function() {
      return func.call(this, keyName);
    };
  }
}

/** @private */
function mkCpSetter(keyName, desc) {
  var cacheable = desc._cacheable,
      func = desc.func;

  return function(value) {
    var m = meta(this, cacheable),
        watched = this === m.source && m.watching[keyName] > 0,
        ret, oldSuspended, lastSetValues;

    oldSuspended = desc._suspended;
    desc._suspended = this;

    watched = watched && guidFor(value) !== m.lastSetValues[keyName];

    if (watched) {
      m.lastSetValues[keyName] = guidFor(value);
      SC.propertyWillChange(this, keyName);
    }

    if (cacheable) { delete m.cache[keyName]; }
    ret = func.call(this, keyName, value);
    if (cacheable) { m.cache[keyName] = ret; }
    if (watched) { SC.propertyDidChange(this, keyName); }
    desc._suspended = oldSuspended;
    return ret;
  };
}

/**
  @ignore
  @private
*/
var Cp = ComputedProperty.prototype;

/**
  Call on a computed property to set it into cacheable mode. When in this
  mode the computed property will automatically cache the return value of
  your function until one of the dependent keys changes.

  @name SC.ComputedProperty#cacheable
  @param {Boolean} [aFlag] Set to false to disable cacheing
  @returns {SC.ComputedProperty} receiver
*/
Cp.cacheable = function(aFlag) {
  this._cacheable = aFlag !== false;
  return this;
};

/**
  Sets the dependent keys on this computed property. Pass any number of
  arguments containing key paths that this computed property depends on.

  @name SC.ComputedProperty#property
  @param {String} path... zero or more property paths
  @returns {SC.ComputedProperty} receiver
*/
Cp.property = function() {
  this._dependentKeys = a_slice.call(arguments);
  return this;
};

/**
  @private

  Implement descriptor API
*/
Cp.setup = function(obj, keyName, value) {
  CP_DESC.get = mkCpGetter(keyName, this);
  CP_DESC.set = mkCpSetter(keyName, this);
  o_defineProperty(obj, keyName, CP_DESC);
  CP_DESC.get = CP_DESC.set = null;
  addDependentKeys(this, obj, keyName);
};

/**
  @private

  Implement descriptor API
*/
Cp.teardown = function(obj, keyName) {
  var keys = this._dependentKeys,
      len  = keys ? keys.length : 0,
      idx;

  for (idx = 0; idx < len; idx++) {
    removeDependentKey(obj, keyName, keys[idx]);
  }

  if (this._cacheable) { delete meta(obj).cache[keyName]; }

  // no value to restore
  return null;
};

/**
  @private

  Implement descriptor API
*/
Cp.didChange = function(obj, keyName) {
  if (this._cacheable && obj !== this._suspended) {
    delete meta(obj).cache[keyName];
  }
};

/**
  @private

  Implement descriptor API
*/
Cp.get = function(obj, keyName) {
  var ret, cache;

  if (this._cacheable) {
    cache = meta(obj).cache;
    if (keyName in cache) { return cache[keyName]; }
    ret = cache[keyName] = this.func.call(obj, keyName);
  } else {
    ret = this.func.call(obj, keyName);
  }

  return ret;
};

/**
  @private

  Implement descriptor API
*/
Cp.set = function(obj, keyName, value) {
  var cacheable = this._cacheable,
      m = meta(obj, cacheable),
      watched = m.source===obj && m.watching[keyName] > 0,
      ret, oldSuspended, lastSetValues;

  oldSuspended = this._suspended;
  this._suspended = obj;

  watched = watched && guidFor(value) !== m.lastSetValues[keyName];

  if (watched) {
    m.lastSetValues[keyName] = guidFor(value);
    SC.propertyWillChange(obj, keyName);
  }

  if (cacheable) { delete m.cache[keyName]; }
  ret = this.func.call(obj, keyName, value);
  if (cacheable) { m.cache[keyName] = ret; }
  if (watched) { SC.propertyDidChange(obj, keyName); }
  this._suspended = oldSuspended;
  return ret;
};

/**
  @private

  Implement descriptor API
*/
Cp.val = function(obj, keyName) {
  return meta(obj, false).values[keyName];
};

if (!SC.platform.hasPropertyAccessors) {
  /** @private */
  Cp.setup = function(obj, keyName, value) {
    // so it shows up in key iteration
    obj[keyName] = undefined;
    addDependentKeys(this, obj, keyName);
  };
} else if (!USE_ACCESSORS) {
  /** @private */
  Cp.setup = function(obj, keyName) {
    // throw exception if not using SC.get() and SC.set() when supported
    o_defineProperty(obj, keyName, CP_DESC);
    addDependentKeys(this, obj, keyName);
  };
} 

/**
  This helper returns a new property descriptor that wraps the passed
  computed property function. You can use this helper to define properties
  with mixins or via SC.defineProperty().

  The function you pass will be used to both get and set property values.
  The function should accept two parameters, key and value. If value is not
  undefined you should set the value first. In either case return the
  current value of the property.

  @param {Function} func
    The computed property function.

  @returns {SC.ComputedProperty} property descriptor instance
*/
SC.computed = function(func) {
  return new ComputedProperty(func);
};
