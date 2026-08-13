# weaccess-ai-signlanguage

Sign language translation for React Native apps. While the SDK is on, a tap on
text sends that sentence to the SignForDeaf backend, which renders a sign
language video of it. The video plays in a small floating player over your app.

The app stays usable the whole time. There is no scrim, the player covers a
corner rather than half the screen, and taps the SDK has no business claiming go
straight through to you.

```sh
npm install weaccess-ai-signlanguage
cd ios && pod install
```

That is the whole install. The SDK plays video itself rather than asking you to
add a video library.

## Quick start

Wrap your app once, at the root, and supply your credentials.

```tsx
import { SignLanguageProvider } from 'weaccess-ai-signlanguage';

export default function App() {
  return (
    <SignLanguageProvider
      config={{
        apiKey: 'YOUR_API_KEY',
        apiUrl: 'https://YOUR_INSTANCE.signfordeaf.com',
        language: 'tr',
      }}
    >
      <YourApp />
    </SignLanguageProvider>
  );
}
```

That is the whole integration. **You do not have to mark your text in any way** —
no wrapper component, no `selectable`, no change to your screens. The SDK reads
the text straight from your React tree.

## How a user uses it

1. A floating button appears at the edge of the screen — the SDK's only
   permanent presence.
2. Tapping it opens the player and turns tap mode on. The button hides while the
   player is up, because the player carries its own controls.
3. With the player open, tapping text translates the sentence under the finger.
   The next sentence is fetched in the background, so stepping through a
   paragraph is usually instant.
4. Collapsing the player hands the app back completely. Closing it returns to the
   floating button.

## What a tap does, and does not, claim

This is the part worth understanding, because the SDK sits between your users
and every tap they make.

| You tap                                         | What happens                                 |
| ----------------------------------------------- | -------------------------------------------- |
| A paragraph                                     | The sentence under your finger is translated |
| A button **with a label**                       | The label is **read**, not pressed           |
| An icon-only button, a switch, a checkbox's box | Your app gets the tap, as always             |
| A text field                                    | It focuses and keeps its caret               |
| Anywhere, and drag                              | It scrolls                                   |

A labelled button being read rather than pressed is deliberate: a Deaf user could
otherwise translate a contract but not the button that agrees to it — the one
word that matters most. To _operate_ a labelled control, collapse the player.

The same row therefore reads when tapped on its label and ticks when tapped on
its checkbox. Icon glyphs are not treated as text, so icon buttons keep working.

## Sensitive data

Text containing personal data never reaches the translation backend. E-mail
addresses, Turkish IBANs, mobile numbers, checksum-valid identity numbers and
Luhn-valid card numbers are detected and refused, per sentence — one clause
carrying an ID number blocks only itself.

Detection is a safety net, not a guarantee. It does not catch addresses, names,
or personal data written out in prose. If you know a region is sensitive, mark
it:

```tsx
import { SignLanguageSensitive } from 'weaccess-ai-signlanguage';

<SignLanguageSensitive text={customer.fullName}>
  <Text>{customer.fullName}</Text>
</SignLanguageSensitive>;
```

Marked text stays visible and selectable — only translation is refused.

## Configuration

Only `apiKey` and `apiUrl` are required. Everything else has a default that
produces the standard behaviour.

```tsx
<SignLanguageProvider
  config={{
    apiKey: 'YOUR_API_KEY',
    apiUrl: 'https://YOUR_INSTANCE.signfordeaf.com',

    language: 'tr', // 'tr' | 'en' | 'ar'
    theme: { primaryColor: '#6750A4' },
    card: { showSpeed: true, showLoop: true },
    storage: AsyncStorage, // remembers speed and loop across launches
  }}
  autoEnable
/>
```

### Keeping the key out of the repository

`apiKey` and `apiUrl` identify _your_ account, so they belong in your build
environment rather than in a source file. The example app shows the pattern:
the values live in a gitignored `.env` (or in the shell that starts Metro),
Babel inlines them into the bundle at transform time, and what is committed is
a placeholder — see [`example/.env.example`](example/.env.example) and
[`example/env.ts`](example/env.ts).

```tsx
config={{ apiKey: process.env.SFD_API_KEY, apiUrl: process.env.SFD_API_URL }}
```

The inlining is what makes this work in a release build too: Xcode and Gradle
run the bundler without your shell environment, so a value read at runtime would
come out empty there. Note that inlining is not encryption — a build define ends
up in the shipped bundle. It keeps the key out of version control, not out of
the app.

### Root

| Field                  | Default         | What it does                                                |
| ---------------------- | --------------- | ----------------------------------------------------------- |
| `apiKey`               | **required**    | Sent as `rk` on every request                               |
| `apiUrl`               | **required**    | Backend base URL                                            |
| `originUrl`            | `apiUrl`        | Identifies your app: `Origin` header and `url` parameter    |
| `language`             | `'tr'`          | `'tr'`, `'en'` or `'ar'` — also picks the SDK's own strings |
| `translator`           | `'hesna'`       | Which signer translates. See below                          |
| `tid` / `fdid`         | `'43'` / `'35'` | The same choice as ids, for pairs outside the table         |
| `granularity`          | `'sentence'`    | Or `'paragraph'` to translate the whole block               |
| `maxSegmentChars`      | `900`           | Longest text sent in one request                            |
| `smartPassthrough`     | `true`          | Turn off to restore v1's claim-every-tap behaviour          |
| `longPressToTranslate` | `false`         | Long press reaches text you made tappable                   |
| `storage`              | in-memory       | Any `AsyncStorage`-shaped store                             |

### Theme

| Field            | Default   |
| ---------------- | --------- |
| `primaryColor`   | `#6750A4` |
| `textColor`      | `#1C1B1F` |
| `onPrimaryColor` | `#FFFFFF` |
| `surfaceColor`   | `#FFFFFF` |
| `cornerRadius`   | `16`      |

Foreground colours are checked against what sits behind them and replaced with
black or white if they fall below WCAG 4.5:1. An unreadable caption is a defect,
not a styling choice.

### Player

| Field                          | Default            | What it does                               |
| ------------------------------ | ------------------ | ------------------------------------------ |
| `draggable`                    | `true`             | Whether the user can drag the player       |
| `initialCorner`                | `'bottomRight'`    | Corner it opens from                       |
| `showSpeed` / `showLoop`       | `true`             | Speed and loop controls                    |
| `showFeedback` / `showContact` | `false`            | 👍/👎 and contact — endpoints not live yet |
| `speeds`                       | `[1, 1.2, 1.5, 2]` | Cycle order of the speed button            |
| `blurComponent`                | none               | See "Blurring the loading veil"            |

### Floating button

| Field                                       | Default                                      |
| ------------------------------------------- | -------------------------------------------- |
| `enabled`                                   | `true`                                       |
| `idleBehavior`                              | `'peek'` — slides 35% off the edge and fades |
| `idleDelay`                                 | `2500`                                       |
| `size`                                      | `44`                                         |
| `backgroundColor` / `activeBackgroundColor` | white / `primaryColor`                       |
| `iconColor` / `activeIconColor`             | `primaryColor` / white                       |
| `borderColor`                               | `primaryColor` — drawn only while off        |

## Translators

Four signers ship with the SDK, each with an idle clip that loops while a
translation is being fetched:

| `translator`            | `tid` | `fdid` | Sign language |
| ----------------------- | ----- | ------ | ------------- |
| `'kadir'`               | `23`  | `16`   | TSL           |
| `'hesna'` **(default)** | `43`  | `35`   | TSL           |
| `'jason'`               | `44`  | `36`   | BSL           |
| `'owais'`               | `37`  | `29`   | ASL           |

Pick one by name; the ids follow, and so does the idle loop:

```tsx
config={{ apiKey, apiUrl, translator: 'jason' }}   // same as tid '44', fdid '36'
controller.setTranslator('owais');                  // or at runtime
```

`tid`/`fdid` still work and win over the name — set them when you are working
against a pair that is not in the table. The bundled list is exported as
`ALL_SIGNERS` if you want to build your own picker.

That is the point. Your account may be pinned to a translator, and the SDK
should not keep asking for one the backend has already declined to use.

## Controlling it yourself

```tsx
import { useSignLanguageContext } from 'weaccess-ai-signlanguage';

const { state, enable, disable, translate, closePlayer, controller } =
  useSignLanguageContext();

await translate('Merhaba dünya'); // no gesture needed
controller.setLanguage('en');
controller.setTranslator('jason');
controller.setTheme({ primaryColor: '#1B6C4A' });
```

`controller` is the whole state machine if you want to build your own UI around
it — segment navigation, playback, feedback, the event stream.

## Events

```tsx
<SignLanguageProvider
  config={config}
  onEvent={(event) => analytics.track(event.type)}
/>
```

| Event                                            | Fires when                                                |
| ------------------------------------------------ | --------------------------------------------------------- |
| `blockedSensitive`                               | The sentence was refused before any request               |
| `textSelected`                                   | A sentence passed the check and is about to be translated |
| `translationStart`                               | A request is actually going out (not on a cache hit)      |
| `panelOpen`, `videoStart`, `translationComplete` | A video became playable                                   |
| `videoEnd`                                       | Playback reached the end                                  |
| `segmentChanged`                                 | The user moved to another sentence                        |
| `playbackSpeedChanged`, `cardCollapsed`          | The user changed a control                                |
| `translationError`                               | Cancelled, failed, or the video would not load            |
| `panelClose`                                     | The player was dismissed while a translation was playable |

The v1 names (`onTranslationComplete`, `onBottomSheetOpen`, …) still fire
alongside these.

## Video playback

The SDK ships its own native video view — Media3/ExoPlayer on Android,
`AVPlayer` on iOS — so there is no video package to install. It never touches
your app's audio session: the idle signer loop is muted and takes no audio
focus.

One limitation worth knowing if you are on an older React Native: **on Android,
the new architecture needs React Native 0.74 or later.** Before that, React
Native's Fabric renderer had no interop path for view components like this one,
so the video area renders blank. The old architecture works on every supported
version, and iOS works everywhere. (`react-native-video` has the same limitation,
so this is not a step backwards.)

## Blurring the loading veil

While a translation is in flight, the idle signer plays behind a veil so it is
never mistaken for the finished video. React Native has no built-in blur, so pass
one if you want it:

```tsx
import { BlurView } from '@react-native-community/blur';

<SignLanguageProvider
  config={{ ...credentials, card: { blurComponent: BlurView } }}
/>;
```

Without one the veil is a translucent scrim, which reads the same way.

## Accessibility

- Every control is a 44 pt tap target, in every state.
- Every string is localized, including screen-reader labels.
- Contrast below 4.5:1 is corrected, not honoured.
- The caption grows with the system text size rather than clipping.
- The host app stays operable throughout.

## Upgrading from 0.1.x

Your integration keeps working: the v1 entry points and their parameters are
unchanged, and every new setting defaults to v2 behaviour. Two things to do:

1. **Re-run `pod install`** and rebuild — the SDK now ships a native video view.
2. **Delete any `enableGlobalSelectableText()` call.** It is a no-op now — text
   no longer has to be selectable to be translated. (It had also stopped working
   silently on React Native 0.81+, where the API it patched no longer exists.)

See [CHANGELOG.md](CHANGELOG.md) for what changed and why.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
