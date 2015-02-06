/**
@module ember
@submodule ember-routing-views
*/

import ContainerView from "ember-views/views/container_view";
import { _Metamorph } from "ember-views/views/metamorph_view";
import { get } from "ember-metal/property_get";

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
    while (state && emptyRouteState(state)) {
      state = state.outlets.main;
    }
    var different = !sameRouteState(this._lastState, state);
    this._lastState = state;
    return different;
  },

  _setOutletState: function(state) {
    if (!this._diffState(state)) {
      var children = this._childOutlets;
      for (var i = 0 ; i < children.length; i++) {
        var child = children[i];
        child._setOutletState(this._lastState.outlets[child._outletName]);
      }
    } else {
      var view = this._buildView(this._lastState);
      var length = get(this, 'length');
      if (view) {
        this.replace(0, length, [view]);
      } else {
        this.replace(0, length , []);
      }
    }
  },

  _buildView: function(state) {
    var LOG_VIEW_LOOKUPS = get(this, 'namespace.LOG_VIEW_LOOKUPS');
    return buildView(this.container, LOG_VIEW_LOOKUPS, state.renderOptions, this._isTopLevel);
  }
});

function buildView(container, LOG_VIEW_LOOKUPS, renderOptions, isTopLevel) {
  var view;
  var ViewClass = renderOptions.ViewClass;
  var isDefaultView = false;
  
  if (!ViewClass) {
    isDefaultView = true;
    ViewClass = container.lookupFactory(isTopLevel ? 'view:toplevel' : 'view:default');
  }
  
  view = ViewClass.create({
    _debugTemplateName: renderOptions.name,
    renderedName: renderOptions.name,
    controller: renderOptions.controller
  });
  
  if (!get(view, 'template')) {
    view.set('template', renderOptions.template);
  }
  
  if (LOG_VIEW_LOOKUPS) {
    Ember.Logger.info("Rendering " + renderOptions.name + " with " + (renderOptions.isDefaultView ? "default view " : "") + view, { fullName: 'view:' + renderOptions.name });
  }
  
  return view;
}

function emptyRouteState(state) {
  return !state.renderOptions.ViewClass && !state.renderOptions.template;
}

function sameRouteState(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  for (var key in a) {
    if (a.hasOwnProperty(key)) {
      if (key === 'controller') {
        if (a[key] !== b['key'] && get(a[key], 'model') !== get(b[key], 'model')) {
          return false;
        }
      } else {
        if (a[key] !== b['key']) {
          return false;
        }
      }
    }
  }
  return true;
}
