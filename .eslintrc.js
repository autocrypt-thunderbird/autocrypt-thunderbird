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
