<p align="center">
  <a href="README.md">Русский</a>
  &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="README.en.md"><b>English</b></a>
</p>

# Notes

A mobile app for handwritten and typed notes. Draw on the page with a stylus or a finger, place text, stickers, and photos, and organize them with layers and groups.

Built with Expo SDK 58 and React Native. Ink is drawn with Skia.

## Features

- Pressure-sensitive pen, highlighter, eraser, and shapes
- Text, stickers, and photos, plus crop and masks
- Layers, note groups, and pinning
- Export a page to PNG and PDF
- Search by title and text

## Requirements

- Node.js 22 or newer
- npm 11
- A phone with [Expo Go](https://expo.dev/go) for SDK 58

## Run

```bash
npm install
npx expo start
```

If the phone is not on the same network as the computer:

```bash
npx expo start --tunnel
```

Typecheck:

```bash
npx tsc --noEmit
```

## Layout

```text
App.tsx                         screen entry
index.ts                        app registration
app.json                        name, version, iOS and Android ids
eas.json                        cloud build profiles
assets/                         icons
src/
  components/                   note list and editor
  components/canvas/            page, tools, layers
  hooks/useNotes.ts             state and persistence
  storage.ts                    notes on device
  strokeUtils.ts                strokes, eraser, shapes
  skiaStrokes.tsx               ink rendering
  media.ts                      photos on the page
  exportNote.ts                 PNG and PDF
  types.ts                      shared types
```

`ios/` and `android/` are not in the repository. Expo generates them at build time.

## Versions

One user-facing version: `version` in `package.json` and `expo.version` in `app.json`. Format is [SemVer](https://semver.org/): `MAJOR.MINOR.PATCH`.

Day-to-day work lands on the `test` branch. It reaches `main` by merge, and each merge is a new version.

| What the merge contains | Which number to bump |
| --- | --- |
| A fix | patch: `1.0.1` |
| A new capability | minor: `1.1.0` |
| A breaking change to storage or gestures | major: `2.0.0` |

Store builds have their own numbers. Increment them by one on every store upload, even when the user-facing version stays the same.

- Android: `android.versionCode` in `app.json`
- iOS: `ios.buildNumber` in `app.json`

Current release: version **1.0.0**, build **1**. The change history is in [CHANGELOG.md](CHANGELOG.md).

## Builds

Cloud builds go through EAS. The version comes from `app.json`, not from a counter on the server.

```bash
npx eas-cli@latest build -p android --profile preview
npx eas-cli@latest build --profile production
```

## License

This app's code is [MIT](LICENSE), Nikita Moiseenko.

The project started from the Expo template. The template license notice stays in [NOTICE](NOTICE). Expo SDK packages keep their own licenses inside the packages themselves.
