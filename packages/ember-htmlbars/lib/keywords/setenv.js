/*jshint debug:true*/

/**
@module ember
@submodule ember-htmlbars
*/

import { internal } from "htmlbars-runtime";
import o_create from "ember-metal/platform/create";

/**
  @method setenv
  @for Ember.Handlebars.helpers
*/
export default {
  setupState(state, env, scope, params, hash) {
    var read = env.hooks.getValue;
    var newEnv = o_create(null);
    for (var k in hash) {
      if (hash.hasOwnProperty(k)) {
        newEnv[k] = read(hash[k]);
      }
    }
    return { newEnv };
  },

  childEnv(state) {
    return state.newEnv;
  },

  render(renderNode, env, scope, params, hash, template, inverse, visitor) {
    internal.hostBlock(renderNode, env, scope, template, null, null, visitor, function(options) {
      options.templates.template.yield();
    });
  }

};
