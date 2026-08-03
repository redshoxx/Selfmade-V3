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
        versionCode = 19100
        versionName = "19.1.0"
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
