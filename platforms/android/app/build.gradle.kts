plugins {
    id("com.android.application")
}
android {
    signingConfigs {
        create("release") {
            val pf = file("keystore.properties")
            val props = if (pf.exists()) pf.readLines()
                .filter { it.contains('=') && !it.trimStart().startsWith("#") }
                .associate { it.substringBefore('=').trim() to it.substringAfter('=').trim() }
                .toMutableMap() else mutableMapOf<String, String>()
            storeFile = file(props.getOrElse("storeFile") { "keystore/ccx-release.jks" })
            storePassword = props.getOrElse("storePassword") { "ccx-dev-2026" }
            keyAlias = props.getOrElse("keyAlias") { "ccx" }
            keyPassword = props.getOrElse("keyPassword") { "ccx-dev-2026" }
        }
    }
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
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
    externalNativeBuild {
        cmake { path = file("src/main/cpp/CMakeLists.txt") }
    }
}