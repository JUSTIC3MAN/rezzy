import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rezme.game',
  appName: 'RezMe',
  webDir: 'www',

  // Black, so nothing flashes white between the launch screen and the first
  // frame the canvas draws.
  backgroundColor: '#000000',

  ios: {
    backgroundColor: '#000000',

    // WKWebView otherwise reserves room for the notch and home indicator and
    // then letterboxes the game inside what's left. The game already sizes
    // itself to the viewport and the CSS handles the insets, so take the
    // whole screen and let it.
    contentInset: 'never',

    // A game, not a document. Without this a stray drag rubber-bands the whole
    // page and the pointer handlers lose the gesture partway through.
    scrollEnabled: false,

    // The game bundles everything it needs and only reaches the network for the
    // leaderboard, which is HTTPS.
    limitsNavigationsToAppBoundDomains: false
  }
};

export default config;
