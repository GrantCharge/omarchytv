# launcher: index

- `OMARCHYTV.md`: how the launcher works.
- `PLUGINS.md`: plugin notes.
- `REMOTES.md`: remote control notes.
- `docs/INSTALL.md`: install steps. `docs/RELEASE-NOTES-2.10-beta.md`: release notes.
- `build-and-install.sh`, `build-and-install.ps1`: build and install.
- `app/`: app source. `tools/`: helper scripts.

## Rule: install only the dev copy on Grant's TV

- Grant's own launcher on the TV is the dev copy: package `com.omarchytv.home.dev`.
- Do not install, launch, or set as home the plain package `com.omarchytv.home`. That is the official-app copy.
- Build the dev copy with the `devSuffix` flag:
  `cd launcher && ./gradlew -PdevSuffix :app:assembleDebug`
- Install it with: `adb install -r launcher/app/build/outputs/apk/debug/app-debug.apk`
- Check the package before you install it: `aapt2 dump packagename <apk>` must print `com.omarchytv.home.dev`.
- Open it with the Home key (`adb shell input keyevent 3`), or with `adb shell am start -n com.omarchytv.home.dev/com.omarchytv.home.MainActivity`.
- Do not use `launcher/build-and-install.sh` on Grant's TV. It builds and installs `com.omarchytv.home`, and sets it as the home screen.
