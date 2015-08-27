import { get } from 'ember-metal/property_get';
import { meta as metaFor } from 'ember-metal/meta';

export default function Observer(obj, path, target, method) {
  this.obj = obj;
  this.path = path;

  if (method == null && typeof target === 'function') {
    this.target = obj;
    this.method = target;
  } else {
    this.target = target || obj;
    this.method = method;
  }

  let links = path.split('.');
  if (links.length === 1) {
    this.stem = null;
    this.leaf = path;
  } else {
    this.stem = links;
    this.leaf = links.pop();
  }

  this.lastChangeId = this.currentChangeId();
}

Observer.prototype.currentChangeId = function() {
  return currentChangeId(this.obj, this.stem, this.leaf);
};

Observer.prototype.check = function() {
  let oldId = this.lastChangeId;
  let newId = this.currentChangeId();
  this.lastChangeId = newId;
  if (oldId !== newId) {
    this.fire();
  }
};

Observer.prototype.fire = function() {
  let method = this.method;
  if ('string' === typeof method) {
    this.target[method](this.obj, this.path);
  } else {
    method.call(this.target, this.obj, this.path);
  }
};

function currentChangeId(obj, stem, leaf) {
  let latestChange = 0;
  let currentObj = obj;

  if (stem != null) {
    let step = 0;
    while (currentObj && step < stem.length) {
      let currentKey = stem[step];

      // FIXME: we can't do gets, even for intermediate nodes.
      // see testId=84339f63.
      let nextObj = get(currentObj, currentKey);

      latestChange = highestChangeId(latestChange, currentObj, currentKey);
      currentObj = nextObj;
      step++;
    }
  }

  if (currentObj != null) {
    let own = ownChangeId(currentObj, leaf);
    if (own > latestChange) {
      latestChange = own;
    }
  }

  return latestChange;
}

export function ownChangeId(obj, leaf, inMeta) {
  let meta = inMeta || metaFor(obj);
  let ownId = meta.peekChangeIds(leaf) || 0;
  let deps = dependentKeys(obj, leaf);

  if (!deps || depsAreFresh(leaf, meta)) {
    return ownId;
  }

  meta.writeDepsAge(leaf, changeCounter);

  let newestDepId = 0;
  for (let i = 0; i < deps.length; i++) {
    let d = depChangeId(obj, deps[i]);
    if (d > newestDepId) {
      newestDepId = d;
    }
  }
  if (newestDepId > ownId) {
    meta.writeChangeIds(leaf, newestDepId);
    return newestDepId;
  } else {
    return ownId;
  }
}

export function depChangeId(obj, dep) {
  if (dep.length === 1) {
    return currentChangeId(obj, null, dep[0]);
  } else {
    return currentChangeId(obj, dep.slice(0, -1), dep[dep.length - 1]);
  }
}

function highestChangeId(latestChange, currentObj, currentKey) {
  let meta = currentObj.__ember_meta__;
  let changeId = (meta && meta.peekChangeIds(currentKey)) || 0;
  if (changeId > latestChange) {
    return changeId;
  } else {
    return latestChange;
  }
}

function dependentKeys(obj, key) {
  let possibleDesc = obj[key];
  if (possibleDesc != null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor) {
    return possibleDesc._dependentKeys2;
  }
}

function depsAreFresh(key, meta) {
  return meta.peekDepsAge(key) === changeCounter;
}

var changeCounter = 0;

export function nextChangeId() {
  return ++changeCounter;
}
