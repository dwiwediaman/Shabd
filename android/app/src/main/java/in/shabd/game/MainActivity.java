package in.shabd.game;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Force edge-to-edge on ALL Android versions so the WebView extends
        // behind the status bar and env(safe-area-inset-top) returns the
        // correct value everywhere. Without this, older Android clips the
        // WebView below the status bar and safe-area CSS creates blank gaps.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }
}
