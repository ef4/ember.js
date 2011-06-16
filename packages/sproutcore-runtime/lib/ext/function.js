// ==========================================================================
// Project:  SproutCore Runtime
// Copyright: ©2006-2011 Strobe Inc. and contributors.
//            Portions ©2008-2011 Apple Inc. All rights reserved.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================

require('sproutcore-runtime/core');

if (SC.EXTEND_PROTOTYPES) {

  /**
    A helper that allows you to easily create a computed property.
    Normally you will want to use this method, but if for any reason
    you don't want to use prototype extensions (these are turned
    off when SC.EXTEND_PROTOTYPES to false), you'll want to
    use the SC.computed() function.

    ## Examples

        #js:

        var Person = SC.Object.extend({
          firstName: null,
          lastName: null,
          fullName: function() {
            return this.get('firstName') + ' ' + this.get('lastName');
          }.property('firstName', 'lastName')
        });

    Alternatively, if you've set SC.EXTEND_PROTOTYPES to false, you would
    implement a computed property as follows:

        #js:

        var Phone = SC.Object.extend({
          manufacturer: null,
          model: null,
          name: SC.computed(function() {
            return this.get('manufacturer') + ' ' + this.get('model');
          }).property('manufacturer', 'model')
        });

    @param {String} [dependentKeys...]
      The keys you want your computed property to depend on.

    @returns {SC.ComputedProperty} a computed property

    @see SC.computed
  */
  Function.prototype.property = function() {
    var ret = SC.computed(this);
    return ret.property.apply(ret, arguments);
  };

  /**
    A helper that creates an observer which will fire whenever
    one of the provided property paths changes. If SC.EXTEND_PROTOTYPES is
    false, then you need to use SC.observer().

    ## Examples

        #js:

        var obj = SC.Object.create({
          prop: null,
          propDidChange: function() {
            console.log("The new value of prop is: " + this.get('prop'));
          }.observes('prop')
        });

    @param {String} paths...
      The paths you want to listen for changes on

    @returns {Function} The function that is observing for changes

    @see SC.observer
  */
  Function.prototype.observes = function() {
    this.__sc_observes__ = Array.prototype.slice.call(arguments);
    return this;
  };

  /**
    A helper that creates an observer which will fire before
    one of the provided property paths changes. If SC.EXTEND_PROTOTYPES is
    false, then you need to use SC.beforeObserver().

    ## Examples

        #js:

        var obj = SC.Object.create({
          prop: null,
          propWillChange: function() {
            console.log("The old value of prop is: " + this.get('prop'));
          }.observes('prop')
        });

    @param {String} paths...
      The paths you want to listen for changes on

    @returns {Function} this The function that is observing for changes, before they happen

    @see SC.observer
  */
  Function.prototype.observesBefore = function() {
    this.__sc_observesBefore__ = Array.prototype.slice.call(arguments);
    return this;
  };

}
