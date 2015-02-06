/**
@module ember
@submodule ember-routing-views
*/

import ContainerView from "ember-views/views/container_view";
import { _Metamorph } from "ember-views/views/metamorph_view";

export var OutletView = ContainerView.extend(_Metamorph, {
  init: function() {
    this._super();
    this._childOutlets = [];
    this._lastState = null;
  },

  _isOutlet: true,

  _parentOutlet: function() {
    var parent = this._parentView;
    while (parent && !parent._isOutlet) {
      parent = parent._parentView;
    }
    return parent;
  },
  
  _linkParent: Ember.on('didInsertElement', function() {
    var parent = this._parentOutlet();
    if (parent) {
      parent._childOutlets.push(this);
      if (parent._lastState) {
        this._setOutletState(parent._lastState.outlets[this._outletName]);
      }
    }
  }),

  willDestroy: function() {
    var parent = this._parentOutlet();
    if (parent) {
      parent._childOutlets.removeObject(this);
    }
    this._super();
  },

  _diffState: function(state) {
    var different = !this._lastState || this._lastState.viewBuilder !== state.viewBuilder;
    this._lastState = state;
    return different;
  },
  
  _setOutletState: function(state) {
    if (!this._diffState(state)) {
      var children = this._childOutlets;
      for (var i = 0 ; i < children.length; i++) {
        var child = children[i];
        child._setOutletState(state.outlets[child._outletName]);
      }
    } else {
      var viewBuilder = state.viewBuilder;
      var view = viewBuilder && viewBuilder();
      var length = this.get('length');
      if (view) {
        this.replace(0, length, [view]);
      } else {
        this.replace(0, length , []);
      }
    }
  }
});
