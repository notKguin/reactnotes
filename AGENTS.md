This is an Expo SDK 58 / React Native notes app. The screen tree lives in `App.tsx` and `src/components/`. There is no Expo Router.

Working notes for this app, including how to write interface copy, are in `SKILL.md`. Read that file before editing the canvas, version numbers, or license files.

Before writing code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt and follow its links.

Install packages with `npx expo install <package>`.

Keep native projects generated. Do not create or edit `ios/` and `android/` by hand. Configure native behavior in `app.json` and config plugins.

The user-facing version is `expo.version` in `app.json` and must match `version` in `package.json`. Store build numbers are `android.versionCode` and `ios.buildNumber`. Record user-visible changes in `CHANGELOG.md`.
