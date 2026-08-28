package ccx.android;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        TextView tv = new TextView(this);
        tv.setText("CCX shell " + nativeVersion() + "\ncompiler=" + nativeCompiler());
        setContentView(tv);
    }
    private static native String nativeVersion();
    private static native String nativeCompiler();
    static { System.loadLibrary("ccx_shell"); }
}
