# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **The player could sit partly off the screen.** Its position was clamped
  against the size the layout math *predicted*, not the size the card actually
  came out — and when the two disagreed, nothing corrected it, because the
  bounds only recomputed when the prediction changed. Observed on a first
  launch: a 212 pt card starting 325 pt into a 402 pt screen, two thirds of it
  past the right edge. The player now measures itself and re-clamps against the
  frame that exists.
- **Android put the control bar under the navigation bar.** The safe area
  assumed a zero bottom inset, which has been wrong since targetSdk 35 made the
  window edge-to-edge: the gesture bar overlaps the app's own layout. The
  player's bottom edge landed 31 px inside it.

### Added

- `getSafeAreaInsets` on the native module, on both platforms. The insets that
  decide where a floating surface may sit cannot be guessed from the screen
  size — on iOS they follow the device's shape, on Android whether the window is
  edge-to-edge — so the platform is asked. Android reports the *overlap* with
  the window rather than the raw inset, which is what makes the answer correct
  for edge-to-edge and legacy windows alike.

  This needs a native rebuild to take effect. A build without it (or an older
  native module) keeps working: the SDK falls back to an estimate, which now
  reserves Android's gesture bar instead of assuming nothing is there.

### Example app

- Rebuilt on React Native 0.83 / React 19, matching the SDK's own test app.
- **Credentials are build defines.** `apiKey` and the URL parameters come from a
  gitignored `.env` or the shell, inlined by Babel at transform time; the
  committed file is `.env.example`. See the README's "Keeping the key out of the
  repository".

## [2.0.0] - 2026-08-12

### The v1 → v2 shift

v1 blocked the app. A translation opened a half-screen bottom sheet behind a
full-screen scrim, so the page underneath was unreadable and untappable until
the user dismissed it. Tap mode laid a catcher over the whole screen and
swallowed every tap, so the user toggled the mode off to press anything and on
again to read anything.

v2 is built on the opposite premise: **sign language and the host app are used at
the same time.** No scrim, a corner player instead of a sheet, taps classified as
they happen, and one sentence translated instead of a whole paragraph.

**This is a behavior change, not an API change.** Every v1 entry point and
parameter still works, and every new setting defaults to v2 behavior.

### Added

- The **default signer is Hesna** (`tid 43` / `fdid 35`), which is also the
  signer the resolution ladder falls back to — so the idle loop and the
  translation can no longer disagree for an integration that configures nothing.
- `tid` and `fdid` are **optional**, and the backend outranks everyone: once a
  response has named a pair, it is final for the session. A later `configure()`
  or runtime setter cannot take it back, every subsequent request carries it,
  and the idle loop shows that signer. Previously a host changing something
  unrelated — its language, say — silently reverted the translator.
- A non-modal, draggable **player**: a stage with the signer, a control bar
  underneath carrying play/pause, playback speed and loop, and the sentence as a
  caption. Collapses to a single 132×44 bar; closes from a window pill that hangs
  above the stage rather than over the signer.
- **Sentence segmentation.** A tap translates the sentence under the finger, not
  the whole paragraph — tuned for Turkish, so `T.C.`, `A.Ş.`, `5.000.000 TL` and
  numbered clauses do not split.
- **Smart tap passthrough.** A control with a text label is *read*; one without
  (icon button, switch, a checkbox's box) still operates. Editable fields keep
  their focus and caret, and scrolling always passes through.
- **Sensitive-data protection.** E-mail addresses, Turkish IBANs, mobile numbers,
  checksum-valid identity numbers and Luhn-valid card numbers never leave the
  device. Blocking is per sentence. Hosts can mark their own content with
  `<SignLanguageSensitive>`.
- **Idle signer loop** behind a blur and a spinner while a translation is in
  flight, following the translator ids in use.
- **Cache and prefetch**: one sentence ahead, so stepping through a paragraph is
  usually instant. The same sentence is never requested twice.
- **Contrast enforcement.** Any foreground failing WCAG 4.5:1 against its
  background is replaced with black or white.
- Playback speed and loop **persist across sessions**.
- Full localization for Turkish, English and Arabic, including every
  screen-reader label.
- The `SignController`, exported so hosts can drive the SDK from their own UI.

### Changed

- **The player, the translation flow and the API client are now TypeScript**,
  shared by both platforms. They were previously implemented twice, once in
  Kotlin and once in Swift, which is why the two platforms had drifted.
- The **floating button** is a logo-only tab docked to a side edge, themeable and
  draggable, which peeks 35% off that edge after a moment of inactivity and
  disappears entirely while the player is open.
- The **control block is compact when there is nothing to caption**: an open
  player with no translation is just the 44 pt control bar. The stage keeps the
  size it would have had with a caption, so nothing resizes when text arrives.
- Control glyphs are a size down (`iconSize` 18, `primaryIconSize` 20), and every
  glyph now fills its icon box optically — without that contract a chevron and a
  cross given the same size still read at different weights.
- `theme` gained `onPrimaryColor`, `surfaceColor` and `cornerRadius`. The
  default `textColor` is now `#1C1B1F`; it was documented as that but shipped as
  the primary purple.
- German, French and Spanish are still accepted as `language` values but fall
  back to English strings — the backend does not serve them.
- `useSignLanguage` now reads the controller instead of keeping its own copy of
  the state, so the two can no longer disagree.

### Removed

- The native bottom sheets, their ExoPlayer/AVPlayer instances, and both native
  HTTP clients.
- The periodic view-hierarchy scans — every 2000 ms on Android, every 500 ms on
  iOS — which reinstalled gesture recognisers on every pass and were never
  stopped, not even by `disable()`.
- The one-time hint bubble, along with its persisted counter. The player is the
  affordance: it appears the moment the mode turns on, with the signer already
  looping. `hintMaxShows` is still accepted and ignored.
- **`com.google.android.material` is no longer a dependency**, because nothing
  in v2 is a Material view — the bottom sheet it was there for is gone. **If
  your Android theme inherits from `Theme.MaterialComponents.*` and you were
  getting the library transitively through this SDK, your build will now fail
  with `resource style/Theme.MaterialComponents.DayNight.NoActionBar not
  found`.** Declare it yourself, or move to `Theme.AppCompat.*` as the React
  Native template does. Same for `okhttp` and `kotlinx-coroutines`, which the
  native HTTP client used.

### Fixed

- `enableGlobalSelectableText()` patched `Text.render`, which stopped existing at
  React Native 0.81 — it had been a silent no-op there. It is now a documented
  no-op you can delete: text no longer has to be selectable to be translated.
- A translation failure left the sheet spinning forever on both platforms;
  failures now render inside the stage.
- The idle floating button spent the first tap waking up, so users tapped twice.
- Playback controls now keep their 44 pt tap targets at every bar width.
- Cancelling a translation used to hang it. The retry delay rejected with a
  `DOMException`, which Hermes does not define, so the abort threw a
  `ReferenceError` out of its listener and the wait never settled — the request
  stayed pending for good. Node defines that global, which is why no test saw
  it.

### Video playback

The SDK ships its own native video view — Media3/ExoPlayer on Android, `AVPlayer`
on iOS — so `npm install weaccess-ai-signlanguage` plus `pod install` is the
whole setup. There is no video package to add.

A library cannot do this any other way: React Native's autolinking reads only the
*host app's* `package.json` and never walks the dependency tree, so a native
module shipped as our dependency would never be linked. Asking every integrator
to install one was the alternative.

One limitation: on **Android**, the new architecture needs React Native 0.74 or
later — before that its renderer had no interop path for view components like
this one. The old architecture works on every supported version, and iOS works
everywhere.

The SDK also no longer touches the host app's `AVAudioSession`. The idle loop is
muted and takes no audio focus, so it cannot interrupt the host's own playback.

### Blurring the loading veil

The loading veil can blur if you hand it a blur component; without one it falls
back to a translucent scrim, which reads as "not the final video" just as well.
It is injected rather than imported, because a library that `require`s a package
the host has not installed corrupts its own bundle:

```tsx
import { BlurView } from '@react-native-community/blur';

<SignLanguageProvider config={{ ...credentials, card: { blurComponent: BlurView } }}>
```

## [0.1.4] - 2026-01-23

### Changed

- Simplified theme configuration - removed `backgroundColor`, `closeButtonColor`, and `videoBackgroundColor` options
- Theme now only supports `primaryColor` and `textColor` for cleaner API
- `primaryColor` now applies to: logo, title, close button, loading indicator, and retry button
- `textColor` applies to the display text in the bottom sheet

### Removed

- `backgroundColor` theme property (bottom sheet background is now always white)
- `closeButtonColor` theme property (uses `primaryColor` instead)
- `videoBackgroundColor` theme property (video background is now always black)

## [0.1.3] - 2026-01-22

### Fixed

- Android Material theme compatibility - BottomSheet now works without requiring host app to have Material theme
- Added theme color support for Android and iOS bottom sheets

## [0.1.0] - 2025-01-13

### Added

- Initial release of React Native Sign Language Translation library
- iOS native module implementation with Swift
- Android native module implementation with Kotlin
- Text selection support with custom context menu
- Bottom sheet video player for sign language videos
- Support for Turkish, English, and Arabic languages
- React Context and Hook-based API
- SignLanguageProvider component for SDK configuration
- useSignLanguage hook for state and actions
- SignLanguageText and SignLanguageView wrapper components
- Accessibility support with VoiceOver/TalkBack
- TypeScript type definitions
- Example application

### Features

- 🎯 Extends native text selection menu with "Sign Language" action
- 📱 Native bottom sheet with video player
- 🔄 Automatic retry mechanism for API calls
- 🎨 Customizable theme colors
- ♿ Full accessibility support
- 📦 Compatible with React Native CLI and Expo bare workflow
- 🔧 TurboModule-ready architecture

### Supported Platforms

- iOS 13.0+
- Android API 24+ (Android 7.0)
- React Native 0.72+

### Known Issues

- UILabel text selection requires long press gesture on iOS
- Some React Native Text components may need SignLanguageText wrapper

## Future Plans

- [ ] TurboModule implementation for New Architecture
- [ ] Fabric support for custom view components
- [ ] Expo Config Plugin for managed workflow
- [ ] Video caching for offline support
- [ ] Custom sign language dictionary support
