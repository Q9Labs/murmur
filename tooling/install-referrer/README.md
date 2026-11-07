# Install Referrer cleanup regression

This JVM harness extracts and compiles the installed Expo Application callback.
It substitutes only the external client, promise and Android exception boundaries.
It checks connection cleanup, the existing promise results and duplicate callbacks.
It does not reproduce Android Binder failures or measure a device leak.

After installing dependencies and generating the Android project, run with Java 17:

```sh
apps/mobile/android/gradlew --no-daemon -p tooling/install-referrer check
```

To verify the regression, extract the pristine `expo-application@57.0.3` npm artifact
outside the checkout and run the same check against its source:

```sh
apps/mobile/android/gradlew --no-daemon -p tooling/install-referrer --project-prop expoApplicationSource=/absolute/path/to/package/android/src/main/java/expo/modules/application/ApplicationModule.kt check
```

The pristine callback fails with `Connection left open: remoteFailure=true response=0`.
The installed patched callback passes. Mobile CI runs the patched check before its
existing Android build.
