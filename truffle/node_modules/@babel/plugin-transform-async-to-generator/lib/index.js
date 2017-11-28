"use strict";

exports.__esModule = true;
exports.default = _default;

var _helperRemapAsyncToGenerator = _interopRequireDefault(require("@babel/helper-remap-async-to-generator"));

var _helperModuleImports = require("@babel/helper-module-imports");

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(api, options) {
  var method = options.method,
      module = options.module;

  if (method && module) {
    return {
      visitor: {
        Function: function Function(path, state) {
          if (!path.node.async || path.node.generator) return;
          var wrapAsync = state.methodWrapper;

          if (wrapAsync) {
            wrapAsync = _core.types.cloneDeep(wrapAsync);
          } else {
            wrapAsync = state.methodWrapper = (0, _helperModuleImports.addNamed)(path, method, module);
          }

          (0, _helperRemapAsyncToGenerator.default)(path, state.file, {
            wrapAsync: wrapAsync
          });
        }
      }
    };
  }

  return {
    visitor: {
      Function: function Function(path, state) {
        if (!path.node.async || path.node.generator) return;
        (0, _helperRemapAsyncToGenerator.default)(path, state.file, {
          wrapAsync: state.addHelper("asyncToGenerator")
        });
      }
    }
  };
}