/**
 * ClariHear 2.0 — React Native Entry Point
 * New Architecture (Fabric + TurboModules) enabled
 */
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
