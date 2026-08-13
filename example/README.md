# SignForDeaf example app

The SDK showcase: one section per capability, followed by content-rich demo
screens that exercise the same behaviour against realistic layouts. It runs the
library straight from `../src` through Metro, so an edit to the SDK reloads
here without a publish step.

React Native 0.83.1 · React 19.2.0 · new architecture enabled.

## 1. Credentials

The API key and the URL parameters are **build defines**. They are never
committed: Babel inlines them into the bundle at transform time from the build
environment, so what ships is a constant, and what is in git is a placeholder.

```bash
cp .env.example .env    # then fill in SFD_API_KEY
```

| Variable | Required | Meaning |
| --- | --- | --- |
| `SFD_API_KEY` | yes | The key SignForDeaf issued you (sent as `rk`) |
| `SFD_API_URL` | yes | Backend base URL |
| `SFD_ORIGIN_URL` | no | Identifies the app: `Origin` header and `url` parameter. Defaults to `SFD_API_URL` |
| `SFD_FDID` | no | Form/Domain id (`fdid`). Defaults to the SDK's own value |
| `SFD_TID` | no | Translation id (`tid`). Defaults to the SDK's own value |

Exporting the same names in the shell that starts Metro also works, and a shell
value wins over the file. The file exists because Xcode and Gradle run the
bundler without your shell environment, so release builds would otherwise come
out blank.

`.env` is gitignored; `.env.example` is the committed template. The wiring is
`babel.config.js` (loads the file, inlines the listed names) and `env.ts`
(reads them and hands `SDK_ENV` to the provider in `App.tsx`).

> After editing `.env`, restart Metro with `yarn start --reset-cache`. The old
> values otherwise survive in Metro's transform cache.

## 2. Install and run

```bash
yarn install
bundle install && (cd ios && bundle exec pod install)   # iOS only

yarn start
yarn ios       # or: yarn android
```

## 3. Verifying a build carries its key

The values are literals in the bundle, so you can check a build without running
it:

```bash
yarn react-native bundle --platform ios --dev false \
  --entry-file index.js --bundle-output /tmp/check.js
grep -c "$(grep SFD_API_KEY .env | cut -d= -f2)" /tmp/check.js   # 1 = inlined
```

A build with no credentials logs a warning on startup in dev mode instead of
failing silently.
