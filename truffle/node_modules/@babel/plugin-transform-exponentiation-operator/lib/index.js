"use strict";

exports.__esModule = true;
exports.default = _default;

var _helperBuilderBinaryAssignmentOperatorVisitor = _interopRequireDefault(require("@babel/helper-builder-binary-assignment-operator-visitor"));

var _core = require("@babel/core");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default() {
  return {
    visitor: (0, _helperBuilderBinaryAssignmentOperatorVisitor.default)({
      operator: "**",
      build: function build(left, right) {
        return _core.types.callExpression(_core.types.memberExpression(_core.types.identifier("Math"), _core.types.identifier("pow")), [left, right]);
      }
    })
  };
}