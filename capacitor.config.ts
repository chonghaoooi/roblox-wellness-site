import type { CapacitorConfig } from "@capacitor/cli";

// A native health companion for the existing server-rendered site. Keep this origin fixed.
const config: CapacitorConfig = {
  appId: "com.fattofit.robloxtracker",
  appName: "Roblox",
  webDir: "native/www",
  server: {
    url: "https://your-site.example/trackers",
    cleartext: false,
  },
  android: { path: "native/android", backgroundColor: "#000000", allowMixedContent: false },
  ios: { path: "native/ios", backgroundColor: "#000000", preferredContentMode: "mobile" },
};
export default config;
