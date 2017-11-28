"use strict";

exports.__esModule = true;
exports.default = _default;

var _helperRemapAsyncToGenerator = _interopRequireDefault(require("@babel/helper-remap-async-to-generator"));

var _pluginSyntaxAsyncGenerators = _interopRequireDefault(require("@babel/plugin-syntax-async-generators"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default() {
  var yieldStarVisitor = {
    Function: function Function(path) {
      path.skip();
    },
    YieldExpression: function YieldExpression(_ref, state) {
      var node = _ref.node;
      if (!node.delegate) return;
      var callee = state.addHelper("asyncGeneratorDelegate");
      node.argument = _core.types.callExpression(callee, [_core.types.callExpression(state.addHelper("asyncIterator"), [node.argument]), state.addHelper("awaitAsyncGenerator")]);
    }
  };
  return {
    inherits: _pluginSyntaxAsyncGenerators.default,
    visitor: {
      Function: function Function(path, state) {
        if (!path.node.async || !path.node.generator) return;
        path.traverse(yieldStarVisitor, state);
        (0, _helperRemapAsyncToGenerator.default)(path, state.file, {
          wrapAsync: state.addHelper("wrapAsyncGenerator"),
          wrapAwait: state.addHelper("awaitAsyncGenerator")
        });
      }
    }
  };
}