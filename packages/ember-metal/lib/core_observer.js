import { get } from 'ember-metal/property_get';

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
    // Intermediate nodes necessarily need to get evaluated anyway, so
    // we rely on their own descriptor implementations to account for
    // their _dependentKeys during each `get`.
    let step = 0;
    while (currentObj && step < stem.length) {
      let currentKey = stem[step];

      // If currentKey is a computed property, this also ensures that
      // its meta changeIds reflects any upstream dependent key
      // changes. So it's important that this step happens before we
      // check its changeId in highestChangeId() below.
      let nextObj = get(currentObj, currentKey);

      latestChange = highestChangeId(latestChange, currentObj, currentKey);
      currentObj = nextObj;
      step++;
    }
  }

  if (currentObj != null) {
    // Check the leaf's own changeId
    latestChange = highestChangeId(latestChange, currentObj, leaf);

    // The leaf's dependent keys need to be checked explicitly
    let deps = dependentKeys(currentObj, leaf);
    if (deps) {
      for (let i = 0; i < deps.length; i++) {
        let d = depChangeId(currentObj, deps[i]);
        if (d > latestChange) {
          latestChange = d;
        }
      }
    }
  }

  return latestChange;
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


var changeCounter = 0;

export function nextChangeId() {
  return ++changeCounter;
}

export function lastChangeId() {
  return changeCounter;
}
