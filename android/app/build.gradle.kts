plugins {
    id("com.android.application")
}

android {
    namespace = "com.codex.remote"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.codex.remote"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}
