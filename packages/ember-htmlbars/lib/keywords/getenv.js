/*jshint debug:true*/

/**
@module ember
@submodule ember-htmlbars
*/

/**
  @method getenv
  @for Ember.Handlebars.helpers
  @param {String} property
*/
export default function getEnvKeyword(morph, env, scope, params, hash, template, inverse) {
  return env[env.hooks.getValue(params[0])];
}
