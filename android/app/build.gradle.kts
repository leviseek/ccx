plugins {
    id("com.android.application")
}
android {
    namespace = "ccx.android"
    compileSdk = 36
    defaultConfig {
        applicationId = "ccx.android"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        ndk { abiFilters += listOf("x86_64", "arm64-v8a") }
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    externalNativeBuild {
        cmake { path = file("src/main/cpp/CMakeLists.txt") }
    }
}