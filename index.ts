// Widget registration is disabled — to re-enable later, restore the
// `react-native-android-widget` plugin block in app.json and uncomment
// the registerWidgetTaskHandler call below. Keeping the imports off
// also avoids loading the native widget module on app start, which has
// crashed at boot on some Android handsets when the plugin is removed
// but the JS code still wires it up.

// import { registerWidgetTaskHandler } from "react-native-android-widget";
// import { widgetTaskHandler } from "@/widgets/widgetTaskHandler";
// registerWidgetTaskHandler(widgetTaskHandler);

import "expo-router/entry";
