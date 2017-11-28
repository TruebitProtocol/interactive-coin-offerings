"use strict";

exports.__esModule = true;
exports.default = _default;

var _loose = _interopRequireDefault(require("./loose"));

var _vanilla = _interopRequireDefault(require("./vanilla"));

var _helperAnnotateAsPure = _interopRequireDefault(require("@babel/helper-annotate-as-pure"));

var _helperFunctionName = _interopRequireDefault(require("@babel/helper-function-name"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(api, options) {
  var loose = options.loose;
  var Constructor = loose ? _loose.default : _vanilla.default;
  var VISITED = Symbol();
  return {
    visitor: {
      ExportDefaultDeclaration: function ExportDefaultDeclaration(path) {
        if (!path.get("declaration").isClassDeclaration()) return;
        var node = path.node;
        var ref = node.declaration.id || path.scope.generateUidIdentifier("class");
        node.declaration.id = ref;
        path.replaceWith(node.declaration);
        path.insertAfter(_core.types.exportNamedDeclaration(null, [_core.types.exportSpecifier(ref, _core.types.identifier("default"))]));
      },
      ClassDeclaration: function ClassDeclaration(path) {
        var node = path.node;
        var ref = node.id || path.scope.generateUidIdentifier("class");
        path.replaceWith(_core.types.variableDeclaration("let", [_core.types.variableDeclarator(ref, _core.types.toExpression(node))]));
      },
      ClassExpression: function ClassExpression(path, state) {
        var node = path.node;
        if (node[VISITED]) return;
        var inferred = (0, _helperFunctionName.default)(path);

        if (inferred && inferred !== node) {
          path.replaceWith(inferred);
          return;
        }

        node[VISITED] = true;
        path.replaceWith(new Constructor(path, state.file).run());

        if (path.isCallExpression()) {
          (0, _helperAnnotateAsPure.default)(path);

          if (path.get("callee").isArrowFunctionExpression()) {
            path.get("callee").arrowFunctionToExpression();
          }
        }
      }
    }
  };
}