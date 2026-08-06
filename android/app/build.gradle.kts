plugins {
    id("com.android.application")
}

android {
    namespace = "at.selfmade.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "at.selfmade.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 20000
        versionName = "20.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
