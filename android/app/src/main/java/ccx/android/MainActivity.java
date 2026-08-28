package ccx.android;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.view.View;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(new FrameView(this));
    }
    private static native String nativeVersion();
    private static native String nativeCompiler();
    private static native byte[] nativeFrame();
    static { System.loadLibrary("ccx_shell"); }

    // 引擎帧视图：native 帧 -> Bitmap -> 屏幕绘制（W6 真机首帧）
    static class FrameView extends View {
        private final Bitmap frame;
        private final Paint paint = new Paint();

        FrameView(Context c) {
            super(c);
            byte[] px = nativeFrame();
            frame = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888);
            frame.copyPixelsFromBuffer(java.nio.ByteBuffer.wrap(px));
            setBackgroundColor(Color.rgb(16, 16, 32));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth(), h = getHeight();
            int side = Math.min(w, h) - 40;
            int l = (w - side) / 2, t = (h - side) / 2;
            canvas.drawBitmap(frame, null, new android.graphics.Rect(l, t, l + side, t + side), paint);
            paint.setTextSize(28);
            paint.setColor(Color.WHITE);
            canvas.drawText("CCX frame " + nativeVersion() + " (" + nativeCompiler() + ")",
                            l, t - 12, paint);
        }
    }
}
