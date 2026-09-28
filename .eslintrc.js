module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // ponytail: RN 0.74's eslint-plugin-prettier v4 can't load Prettier 3; formatting isn't linted.
    'prettier/prettier': 'off',
  },
};
