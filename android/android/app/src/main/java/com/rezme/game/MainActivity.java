package com.rezme.game;

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

/**
 * Rezzy runs edge to edge in landscape, so the status and navigation bars are
 * hidden and stay hidden.
 *
 * This uses the older setSystemUiVisibility flags rather than
 * WindowInsetsControllerCompat. They are deprecated but still compile and work
 * on every version from API 23 up, and deprecation is only a warning. The
 * modern replacement moved between androidx.core releases, and a build that
 * fails to compile is a worse outcome than a deprecation notice.
 *
 * IMMERSIVE_STICKY is what makes a swipe from the edge show the bars briefly
 * and then hide them again on its own, instead of leaving them on screen and
 * squashing the game.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        goFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Coming back from the recents switcher or a notification shade pull
        // restores the system bars, so re-hide them whenever focus returns.
        if (hasFocus) {
            goFullscreen();
        }
    }

    private void goFullscreen() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }
}
