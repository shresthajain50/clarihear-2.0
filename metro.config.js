const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    // Allow importing .cpp / .h files from js for reference (not compiled here)
    assetExts: ['bin', 'txt', 'jpg', 'png', 'ttf', 'otf', 'mp3', 'wav'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
