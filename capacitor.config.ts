import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.meditrack.diary",
  appName: "MediTrack",
  webDir: "dist/client",
  android: { allowMixedContent: false },
};

export default config;
