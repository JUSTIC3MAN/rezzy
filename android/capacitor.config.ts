import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rezme.game',
  appName: 'RezMe',
  webDir: 'www',

  // Black, so nothing flashes white between the splash screen and the first
  // frame the canvas draws.
  backgroundColor: '#000000',

  android: {
    backgroundColor: '#000000',

    // The game bundles everything it needs and only reaches the network for the
    // leaderboard, which is HTTPS. No reason to allow plaintext.
    allowMixedContent: false
  }
};

export default config;
