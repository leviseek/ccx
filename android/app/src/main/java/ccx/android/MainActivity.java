package ccx.android;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setContentView(new FrameView(this));
    }
    private static native String nativeVersion();
    private static native String nativeCompiler();
    private static native byte[] nativeFrameAt(float t);
    private static native String nativeFrameStats();
    private static native String nativeEval(String code);
    static { System.loadLibrary("ccx_shell"); }

    static class FrameView extends View {
        private final Bitmap frame = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888);
        private final Paint paint = new Paint();
        private final Handler handler = new Handler(Looper.getMainLooper());
        private float t = 0.0f;
        private final Runnable tick = new Runnable() {
            @Override public void run() {
                t += 0.03f;
                byte[] px = nativeFrameAt(t);
                frame.copyPixelsFromBuffer(java.nio.ByteBuffer.wrap(px));
                invalidate();
                handler.postDelayed(this, 16);
            }
        };

        FrameView(Context c) {
            super(c);
            setBackgroundColor(Color.rgb(16, 16, 32));
        }

        @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); handler.post(tick); }
        @Override protected void onDetachedFromWindow() { super.onDetachedFromWindow(); handler.removeCallbacks(tick); }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            int w = getWidth(), h = getHeight();
            int side = Math.min(w, h) - 40;
            int l = (w - side) / 2, top = (h - side) / 2;
            canvas.drawBitmap(frame, null, new android.graphics.Rect(l, top, l + side, top + side), paint);
            paint.setTextSize(28);
            paint.setColor(Color.WHITE);
            canvas.drawText("CCX loop " + nativeVersion() + " (" + nativeCompiler() + ")",
                            l, top - 12, paint);
            paint.setTextSize(22);
            paint.setColor(Color.YELLOW);
            canvas.drawText("script: " + nativeEval("1 + 2 * 3"),
                            l, top + side + 30, paint);
            paint.setColor(Color.CYAN);
            canvas.drawText("stats: " + nativeFrameStats(),
                            l, top + side + 58, paint);
        }
    }
}
