// CCX Android 壳（W6 JNI 最小）：版本/编译器桥；帧循环桥在下一步
#include <jni.h>
#include <string>

extern "C" JNIEXPORT jstring JNICALL
Java_ccx_android_MainActivity_nativeVersion(JNIEnv* env, jobject) {
    return env->NewStringUTF("0.1.0");
}

extern "C" JNIEXPORT jstring JNICALL
Java_ccx_android_MainActivity_nativeCompiler(JNIEnv* env, jobject) {
#ifdef __clang__
    return env->NewStringUTF("clang (NDK)");
#else
    return env->NewStringUTF("gcc");
#endif
}
