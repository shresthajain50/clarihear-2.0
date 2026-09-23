module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Required for JSI / TurboModules
    ['@babel/plugin-transform-class-properties', {loose: true}],
  ],
};
