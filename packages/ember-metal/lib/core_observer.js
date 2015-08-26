import { get } from 'ember-metal/property_get';

export default function Observer(obj, path, target, method) {
  this.obj = obj;
  this.target = target || obj;
  this.method = method;
  this.path = path;

  let leafIndex = path.lastIndexOf('.');
  if (leafIndex === -1) {
    this.stem = null;
    this.leaf = path;
  } else {
    this.stem = path.slice(0, leafIndex);
    this.leaf = path.slice(leafIndex + 1);
  }

  this.lastSetId = this.currentSetId();
}

Observer.prototype.currentSetId = function() {
  let leafObj;
  if (this.stem) {
    leafObj = get(this.obj, this.stem);
  } else {
    leafObj = this.obj;
  }
  let meta = leafObj['__ember_meta__'];
  return meta && meta.peekSetIds(this.leaf);
};

Observer.prototype.check = function() {
  let oldId = this.lastSetId;
  let newId = this.currentSetId();
  this.lastSetId = newId;
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
