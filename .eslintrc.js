module.exports = {
  "rules": {
    "linebreak-style": [
      2,
      "unix"
    ],
    "semi": [
      2,
      "always"
    ],
    "no-unused-vars": 0,
    "no-empty": 0,
    "comma-dangle": 0,
    "consistent-return": 2,
    "block-scoped-var": 2,
    "dot-notation": 2,
    "no-alert": 2,
    "no-caller": 2,
    "no-case-declarations": 2,
    "no-div-regex": 2,
    "no-empty-label": 2,
    "no-empty-pattern": 2,
    "no-eq-null": 2,
    "no-eval": 2,
    "no-extend-native": 2,
    "no-extra-bind": 2,
    "no-fallthrough": 2,
    "no-floating-decimal": 2,
    "no-implicit-coercion": 2,
    "no-implied-eval": 2,
    "no-invalid-this": 2,
    // TODO:
    //"eqeqeq": 2,
  },
  "env": {
    "es6": true,
    "browser": true,
    "node": true,
  },
  "extends": "eslint:recommended"
};
