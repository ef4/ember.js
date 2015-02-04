/**
@module ember
@submodule ember-routing-views
*/

import ContainerView from "ember-views/views/container_view";
import { _Metamorph } from "ember-views/views/metamorph_view";
import { read, subscribe, unsubscribe } from "ember-metal/streams/utils";

export var OutletView = ContainerView.extend(_Metamorph, {
  init: function() {
    this._super();
    this._outletViewStream = this._outletProps.stream.get('viewBuilder');
    subscribe(this._outletViewStream, this._updateOutlet, this);
    this._updateOutlet();
  },
  _updateOutlet: function() {
    var viewBuilder = read(this._outletViewStream);
    var view = viewBuilder && viewBuilder();
    if (view) {
      this.replace(0, 1, [view]);
    } else {
      this.replace(0, 1 , []);
    }
  },
  willDestroy: function() {
    unsubscribe(this._outletViewStream, this._updateOutlet, this);
    this._super();
  }
});
