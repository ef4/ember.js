import Ember from 'ember-metal/core';
import { get } from 'ember-metal/property_get';
import { internal } from 'htmlbars-runtime';
import { read } from 'ember-metal/streams/utils';

export default {
  setupState(state, env, scope, params, hash) {
    var controller = hash.controller;

    if (controller) {
      if (!state.controller) {
        var context = params[0];
        var controllerFactory = env.container.lookupFactory('controller:' + controller);
        var parentController = null;

        if (scope.locals.controller) {
          parentController = read(scope.locals.controller);
        } else if (scope.locals.view) {
          parentController = get(read(scope.locals.view), 'context');
        }

        var controllerInstance = controllerFactory.create({
          model: env.hooks.getValue(context),
          parentController: parentController,
          target: parentController
        });

        params[0] = controllerInstance;
        return { controller: controllerInstance };
      }

      return state;
    }

    return { controller: null };
  },

  isStable() {
    return true;
  },

  isEmpty(state) {
    return false;
  },

  render(morph, env, scope, params, hash, template, inverse, visitor) {
    if (morph.state.controller) {
      morph.addDestruction(morph.state.controller);
      hash.controller = morph.state.controller;
    }

    Ember.assert(
      '{{#with foo}} must be called with a single argument or the use the ' +
      '{{#with foo as |bar|}} syntax',
      params.length === 1
    );

    Ember.assert(
      'The {{#with}} helper must be called with a block',
      !!template
    );

    internal.continueBlock(morph, env, scope, 'with', params, hash, template, inverse, visitor);
  },

  rerender(morph, env, scope, params, hash, template, inverse, visitor) {
    internal.continueBlock(morph, env, scope, 'with', params, hash, template, inverse, visitor);
  }
};
