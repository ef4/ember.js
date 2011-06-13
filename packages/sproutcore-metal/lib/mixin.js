// ==========================================================================
// Project:  SproutCore Runtime
// Copyright: ©2011 Strobe Inc. and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

require('sproutcore-metal/core');
require('sproutcore-metal/accessors');
require('sproutcore-metal/computed');
require('sproutcore-metal/properties');
require('sproutcore-metal/observer');
require('sproutcore-metal/utils');

var Mixin, MixinDelegate, REQUIRED, Alias;
var classToString;

var a_map = Array.prototype.map;
var EMPTY_META = {}; // dummy for non-writable meta
var META_SKIP = { __scproto__: true, __sc_count__: true };

var o_create = SC.platform.create;

/** @private */
function meta(obj, writable) {
  var m = SC.meta(obj, writable !== false),
      ret = m.mixins;

  if (writable === false) { return ret || EMPTY_META; }
  
  if (!ret) {
    ret = m.mixins = { __scproto__: obj };
  } else if (ret.__scproto__ !== obj) {
    ret = m.mixins = o_create(ret);
    ret.__scproto__ = obj;
  }

  return ret;
}

/** @private */
function initMixin(mixin, args) {
  if (args && args.length > 0) {
    mixin.mixins = a_map.call(args, function(x) {
      if (x instanceof Mixin) { return x; }

      // Note: Manually setup a primitive mixin here. This is the only
      // way to actually get a primitive mixin. This way normal creation
      // of mixins will give you combined mixins...
      var mixin = new Mixin();
      mixin.properties = x;
      return mixin;
    });
  }

  return mixin;
} 

var NATIVES = [Boolean, Object, Number, Array, Date, String];

/** @private */
function isMethod(obj) {
  if (typeof obj !== 'function' || obj.isMethod === false) { return false; }
  return NATIVES.indexOf(obj) < 0;
}

/** @private */
function mergeMixins(mixins, m, descs, values, base) {
  var len = mixins.length, idx,
      mixin, guid, props, value,
      key, ovalue, concats;

  /** @private */
  function removeKeys(keyName) {
    delete descs[keyName];
    delete values[keyName];
  }

  for (idx = 0; idx < len; idx++) {
    mixin = mixins[idx];
    if (!mixin) { throw new Error('Null value found in SC.mixin()'); }

    if (mixin instanceof Mixin) {
      guid = SC.guidFor(mixin);
      if (m[guid]) { continue; }
      m[guid] = mixin;
      props = mixin.properties;
    } else {
      // apply anonymous mixin properties
      props = mixin;
    }

    if (props) {
      // reset before adding each new mixin to pickup concats from previous
      concats = values.concatenatedProperties || base.concatenatedProperties;
      if (props.concatenatedProperties) {
        concats = concats ? concats.concat(props.concatenatedProperties) : props.concatenatedProperties;
      }

      for (key in props) {
        if (!props.hasOwnProperty(key)) { continue; }
        value = props[key];
        if (value instanceof SC.Descriptor) {
          if (value === REQUIRED && descs[key]) { continue; }

          descs[key]  = value;
          values[key] = undefined;
        } else {
          // impl super if needed...
          if (isMethod(value)) {
            ovalue = descs[key] === SC.SIMPLE_PROPERTY && values[key];
            if (!ovalue) { ovalue = base[key]; }
            if (typeof ovalue !== 'function') { ovalue = null; }
            if (ovalue) {
              var o = value.__sc_observes__,
                  ob = value.__sc_observesBefore__;

              value = SC.wrap(value, ovalue);
              value.__sc_observes__ = o;
              value.__sc_observesBefore__ = ob;
            }
          } else if ((concats && concats.indexOf(key)>=0) || key === 'concatenatedProperties') {
            var baseValue = values[key] || base[key];
            value = baseValue ? baseValue.concat(value) : SC.makeArray(value);
          }

          descs[key]  = SC.SIMPLE_PROPERTY;
          values[key] = value;
        }
      }
    } else if (mixin.mixins) {
      mergeMixins(mixin.mixins, m, descs, values, base);
      if (mixin._without) { mixin._without.forEach(removeKeys); }
    }
  }
}

var defineProperty = SC.defineProperty;

/** @private */
function writableReq(obj) {
  var m = SC.meta(obj), req = m.required;
  if (!req || (req.__scproto__ !== obj)) {
    req = m.required = req ? o_create(req) : { __sc_count__: 0 };
    req.__scproto__ = obj;
  }

  return req;
}

/** @private */
function getObserverPaths(value) {
  return typeof value === 'function' && value.__sc_observes__;
}

/** @private */
function getBeforeObserverPaths(value) {
  return typeof value === 'function' && value.__sc_observesBefore__;
}

/** @private */
SC._mixinBindings = function(obj, key, value, m) {
  return value;
};

/** @private */
function applyMixin(obj, mixins, partial) {
  var descs = {}, values = {}, m = SC.meta(obj), req = m.required,
      key, willApply, didApply, value, desc,
      mixinBindings = SC._mixinBindings;

  mergeMixins(mixins, meta(obj), descs, values, obj);

  if (MixinDelegate.detect(obj)) {
    willApply = values.willApplyProperty || obj.willApplyProperty;
    didApply  = values.didApplyProperty || obj.didApplyProperty;
  }

  for(key in descs) {
    if (!descs.hasOwnProperty(key)) { continue; }

    desc = descs[key];
    value = values[key];

    if (desc === REQUIRED) {
      if (!(key in obj)) {
        if (!partial) { throw new Error('Required property not defined: ' + key); }

        // for partial applies add to hash of required keys
        req = writableReq(obj);
        req.__sc_count__++;
        req[key] = true;
      }
    } else {
      while (desc instanceof Alias) {
        var altKey = desc.methodName;

        if (descs[altKey]) {
          value = values[altKey];
          desc = descs[altKey];
        } else if (m.descs[altKey]) {
          desc = m.descs[altKey];
          value = desc.val(obj, altKey);
        } else {
          value = obj[altKey];
          desc = SC.SIMPLE_PROPERTY;
        }
      }

      if (willApply) { willApply.call(obj, key); }

      var observerPaths = getObserverPaths(value),
          curObserverPaths = observerPaths && getObserverPaths(obj[key]),
          beforeObserverPaths = getBeforeObserverPaths(value),
          curBeforeObserverPaths = beforeObserverPaths && getBeforeObserverPaths(obj[key]),
          len, idx;

      if (curObserverPaths) {
        len = curObserverPaths.length;
        for (idx = 0; idx < len; idx++) {
          SC.removeObserver(obj, curObserverPaths[idx], null, key);
        }
      }

      if (curBeforeObserverPaths) {
        len = curBeforeObserverPaths.length;
        for (idx = 0; idx < len; idx++) {
          SC.removeBeforeObserver(obj, curBeforeObserverPaths[idx], null, key);
        }
      }

      // TODO: less hacky way for sproutcore-runtime to add bindings.
      value = mixinBindings(obj, key, value, m);

      defineProperty(obj, key, desc, value);

      if (observerPaths) {
        len = observerPaths.length;
        for (idx = 0; idx < len; idx++) {
          SC.addObserver(obj, observerPaths[idx], null, key);
        }
      }

      if (beforeObserverPaths) {
        len = beforeObserverPaths.length;
        for( idx = 0; idx < len; idx++) {
          SC.addBeforeObserver(obj, beforeObserverPaths[idx], null, key);
        }
      }

      if (req && req[key]) {
        req = writableReq(obj);
        req.__sc_count__--;
        req[key] = false;
      }

      if (didApply) { didApply.call(obj, key); }

    }
  }

  // Make sure no required attrs remain
  if (!partial && req && req.__sc_count__ > 0) {
    var keys = [];
    for (key in req) {
      if (META_SKIP[key]) { continue; }
      keys.push(key);
    }

    throw new Error('Required properties not defined: ' + keys.join(','));
  }
  return obj;
}

/**
  @param {Object} obj Object to mix other objects into
  @param {Object...} args Objects to mixin
  @returns {Object} The complete object
*/
SC.mixin = function(obj) {
  var args = Array.prototype.slice.call(arguments, 1);
  return applyMixin(obj, args, false);
};


/**
  @lends SC.Mixin
*/
Mixin = function() { return initMixin(this, arguments); };

/** @private */
Mixin._apply = applyMixin;

Mixin.applyPartial = function(obj) {
  var args = Array.prototype.slice.call(arguments, 1);
  return applyMixin(obj, args, true);
};

Mixin.create = function() {
  classToString.processed = false;
  var M = this;
  return initMixin(new M(), arguments);
};

Mixin.prototype.reopen = function() {
  var mixin, tmp;

  if (this.properties) {
    mixin = Mixin.create();
    mixin.properties = this.properties;
    delete this.properties;
    this.mixins = [mixin];
  }

  var len = arguments.length, mixins = this.mixins, idx;

  for (idx = 0; idx < len; idx++) {
    mixin = arguments[idx];

    if (mixin instanceof Mixin) {
      mixins.push(mixin);
    } else {
      tmp = Mixin.create();
      tmp.properties = mixin;
      mixins.push(tmp);
    }
  }

  return this;
};

var TMP_ARRAY = [];

Mixin.prototype.apply = function(obj) {
  TMP_ARRAY.length = 0;
  TMP_ARRAY[0] = this;
  return applyMixin(obj, TMP_ARRAY, false);
};

Mixin.prototype.applyPartial = function(obj) {
  TMP_ARRAY.length = 0;
  TMP_ARRAY[0] = this;
  return applyMixin(obj, TMP_ARRAY, true);
};

/** @private */
function _detect(curMixin, targetMixin, seen) {
  var guid = SC.guidFor(curMixin);

  if (seen[guid]) { return false; }
  seen[guid] = true;

  if (curMixin === targetMixin) { return true; }
  var mixins = curMixin.mixins, loc = mixins ? mixins.length : 0;
  while(--loc >= 0) {
    if (_detect(mixins[loc], targetMixin, seen)) { return true; }
  }

  return false;
}

/**
  @returns {Boolean} true if object has this SC.Mixin applied, false otherwise
*/
Mixin.prototype.detect = function(obj) {
  if (!obj) { return false; }
  if (obj instanceof Mixin) { return _detect(obj, this, {}); }
  return !!meta(obj, false)[SC.guidFor(this)];
};

Mixin.prototype.without = function() {
  var ret = new Mixin(this);
  ret._without = Array.prototype.slice.call(arguments);
  return ret;
};

/** @private */
function _keys(ret, mixin, seen) {
  var props, key;

  if (seen[SC.guidFor(mixin)]) { return; }
  seen[SC.guidFor(mixin)] = true;

  if (mixin.properties) {
    props = mixin.properties;
    for(key in props) {
      if (props.hasOwnProperty(key)) { ret[key] = true; }
    }
  } else if (mixin.mixins) {
    mixin.mixins.forEach(function(x) {
      _keys(ret, x, seen);
    });
  }
}

/**
  @returns {Array} An array of key names
*/
Mixin.prototype.keys = function() {
  var keys = {}, seen = {}, ret = [], key;
  _keys(keys, this, seen);

  for (key in keys) {
    if (keys.hasOwnProperty(key)) { ret.push(key); }
  }

  return ret;
};

/**
  @private

  Make Mixin's have nice displayNames
*/
var NAME_KEY = SC.GUID_KEY + '_name';

/** @private */
function processNames(paths, root, seen) {
  var idx = paths.length,
      obj, key;

  for(key in root) {
    if (!root.hasOwnProperty(key)) { continue; }
    obj = root[key];
    paths[idx] = key;

    if (obj && obj.toString === classToString) {
      obj[NAME_KEY] = paths.join('.');
    } else if (key === 'SC' || (SC.Namespace && obj instanceof SC.Namespace)) {
      if (seen[SC.guidFor(obj)]) continue;
      seen[SC.guidFor(obj)] = true;
      processNames(paths, obj, seen);
    }
  }

  // cut out last item
  paths.length = idx;
}

/** @private */
classToString = function() {
  if (!this[NAME_KEY] && !classToString.processed) {
    classToString.processed = true;
    processNames([], window, {});
  }
  return this[NAME_KEY] || "(unknown mixin)";
};

Mixin.prototype.toString = classToString;

// TODO: Make SC.mixin
/**
  Returns the mixins currently applied to the specified object

  @param {Object} obj The object to check
*/
Mixin.mixins = function(obj) {
  var ret = [], mixins = meta(obj, false),
      key, mixin;

  for (key in mixins) {
    if (META_SKIP[key]) { continue; }
    mixin = mixins[key];

    // skip primitive mixins since these are always anonymous
    if (!mixin.properties) { ret.push(mixins[key]); }
  }
  return ret;
};

/** @private */
REQUIRED = new SC.Descriptor();

/** @private */
REQUIRED.toString = function() { return '(Required Property)'; };

/**
  Denotes a required property. When an object includes a mixin,
  it is checked for any required properties. If they are not
  present, then an error is thrown.
*/
SC.required = function() {
  return REQUIRED;
};

/** @private */
Alias = function(methodName) {
  this.methodName = methodName;
};
Alias.prototype = new SC.Descriptor();

/**
  Aliases a method name so either can be called.

  ## Examples

      MyMixin = SC.Mixin.create({
        myMethod: function() {
          console.log("My method called");
        },
        myOtherMethod: SC.alias("myMethod")
      });

  @param {String} methodName The method to alias
*/
SC.alias = function(methodName) {
  return new Alias(methodName);
};

/**
  @class
*/
SC.Mixin = Mixin;

MixinDelegate = Mixin.create({

  willApplyProperty: SC.required(),
  didApplyProperty:  SC.required()
  
});

/** @private */
SC.MixinDelegate = MixinDelegate;


// ..........................................................
// OBSERVER HELPER
// 

/**
  Create an observer.

  @param {Function} func
    The observer function to call whenever a path is changed

  @param {String...} paths
    The paths to observe

  @returns {Function} The function
*/
SC.observer = function(func) {
  var paths = Array.prototype.slice.call(arguments, 1);
  func.__sc_observes__ = paths;
  return func;
};

/**
  Create an observer that will be called before an observed
  property is changed

  @param {Function} func
    The observer function to call whenever a path is about to be changed

  @param {String...} paths
    The paths to observe

  @returns {Function} The function
*/
SC.beforeObserver = function(func) {
  var paths = Array.prototype.slice.call(arguments, 1);
  func.__sc_observesBefore__ = paths;
  return func;
};
