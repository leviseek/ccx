package ccx.android

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val tv = TextView(this)
        tv.text = "CCX shell " + nativeVersion() + "\n(cmake=" + nativeCompiler() + ")"
        setContentView(tv)
    }
    private external fun nativeVersion(): String
    private external fun nativeCompiler(): String
    companion object { init { System.loadLibrary("ccx_shell") } }
}
