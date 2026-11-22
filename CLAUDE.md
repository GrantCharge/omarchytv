# omarchytv-fork: where things are

This file only routes. Detail is in `README.md` (large, read parts only).

- `launcher/`: Android TV launcher app. See `launcher/CLAUDE.md`.
- `webos/`: LG webOS app. See `webos/CLAUDE.md`.
- `tizen/`: Samsung Tizen app. See `tizen/CLAUDE.md`.
- `mobile-companion/`: phone app. See `mobile-companion/CLAUDE.md`.
- `pc-plugin/`: PC side (`omarchy-link`, `omarchy-tv`). Read `pc-plugin/README.md`.
- `homewatch/`: home watch service. Read `homewatch/README.md`.
- `tools/`: helper scripts. See `tools/CLAUDE.md`.
- `docs/`: guides and pictures. See `docs/CLAUDE.md`.
- `CHANGELOG.md`, `RELEASE-2.12.0-beta.md`: what changed.

## Rule: install only the dev copy on Grant's TV

- Grant's own launcher on the TV is the dev copy: package `com.omarchytv.home.dev`.
- Do not install, launch, or set as home the plain package `com.omarchytv.home`. That is the official-app copy.
- Build the dev copy with the `devSuffix` flag:
  `cd launcher && ./gradlew -PdevSuffix :app:assembleDebug`
- Install it with: `adb install -r launcher/app/build/outputs/apk/debug/app-debug.apk`
- Check the package before you install it: `aapt2 dump packagename <apk>` must print `com.omarchytv.home.dev`.
- Open it with the Home key (`adb shell input keyevent 3`), or with `adb shell am start -n com.omarchytv.home.dev/com.omarchytv.home.MainActivity`.
- Do not use `launcher/build-and-install.sh` on Grant's TV. It builds and installs `com.omarchytv.home`, and sets it as the home screen.

## Agent skills

### Issue tracker

GitHub issues in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five roles, label names equal the role names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
