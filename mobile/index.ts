import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

// Registers the root component under the name "main", which is the name
// MainActivity.getMainComponentName() looks for. Without this, the release
// APK crashes on launch with "Application ... has not been registered".
registerRootComponent(App);
