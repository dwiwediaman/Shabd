# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Preserve line numbers so Play Console can de-obfuscate stack traces
# using the uploaded mapping.txt. SourceFile is renamed to a placeholder
# so the original .java path doesn't leak into release crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor 8 ships consumer ProGuard rules in capacitor-android.aar that
# preserve plugin classes reflected from the JS bridge — no manual -keep
# entries needed for first-party Capacitor plugins. Add app-specific
# -keep rules below if you ever wire native code that's invoked via
# reflection (e.g. a custom JavaScriptInterface).
