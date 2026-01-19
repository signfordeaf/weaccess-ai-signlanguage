# weaccess-ai-signlanguage

[![npm version](https://badge.fury.io/js/weaccess-ai-signlanguage.svg)](https://badge.fury.io/js/weaccess-ai-signlanguage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-ios%20%7C%20android-lightgrey)](https://reactnative.dev/)

A powerful React Native library that seamlessly integrates **Sign Language accessibility** into your mobile applications. Empower deaf and hard-of-hearing users with instant sign language video translations through an intuitive text selection interface.

## ✨ Key Features

- 🎯 **Zero-Config Integration** - Automatically enhances all text components with sign language support
- 📝 **Smart Text Selection** - Context menu integration for seamless translation workflow
- 🎬 **Real-time Video Translation** - High-quality sign language videos via SignForDeaf API
- 📱 **Native UI Components** - Platform-native bottom sheets and video players for optimal UX
- ♿ **Full Accessibility** - Complete VoiceOver (iOS) and TalkBack (Android) support
- 🌍 **Multi-language Support** - Turkish, English, German, French, Spanish, and Arabic
- 🎨 **Customizable Theming** - Adapt colors and styles to match your brand identity
- ⚡ **High Performance** - Optimized native modules for smooth operation

## 📦 Installation

```bash
npm install weaccess-ai-signlanguage
# or
yarn add weaccess-ai-signlanguage
```

### iOS

```bash
cd ios && pod install
```

### Android

Ensure you have internet permission in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## 🚀 Quick Start

### 1. Wrap Your App with Provider

```tsx
import {
  SignLanguageProvider,
  enableGlobalSelectableText,
} from 'weaccess_ai_signlanguage';

// Enable globally before app renders
enableGlobalSelectableText();

const App = () => {
  return (
    <SignLanguageProvider
      config={{
        apiKey: 'YOUR_API_KEY',
        apiUrl: 'https://api.signfordeaf.com',
        language: 'tr', // 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar'
      }}
      onReady={() => console.log('SDK ready')}
      onError={(error) => console.error('SDK Error:', error)}
    >
      <YourApp />
    </SignLanguageProvider>
  );
};
```

### 2. That's It! 🎉

All `Text` components in your app now support sign language translation. Users can long-press any text and select "Sign Language" from the context menu.

```tsx
import { Text, View } from 'react-native';

const MyScreen = () => {
  return (
    <View>
      <Text>Long press this text to see the sign language option!</Text>
      <Text style={{ fontSize: 18 }}>All texts work automatically.</Text>
    </View>
  );
};
```

## 📖 API Reference

### SignLanguageProvider

| Prop         | Type                                 | Required | Default | Description              |
| ------------ | ------------------------------------ | -------- | ------- | ------------------------ |
| `config`     | `SignLanguageConfig`                 | Yes      | -       | SDK configuration        |
| `onReady`    | `() => void`                         | No       | -       | Called when SDK is ready |
| `onError`    | `(error: SignLanguageError) => void` | No       | -       | Called on errors         |
| `autoEnable` | `boolean`                            | No       | `true`  | Auto-enable on mount     |

### SignLanguageConfig

```typescript
interface SignLanguageConfig {
  apiKey: string; // Your SignForDeaf API key
  apiUrl: string; // API base URL
  language?: 'tr' | 'en' | 'ar'; // Translation language (default: 'tr')
  theme?: SignLanguageTheme; // Theme customization
  accessibility?: AccessibilityConfig;
}
```

### useSignLanguage Hook

```typescript
const {
  isEnabled, // Whether SDK is enabled
  isLoading, // Whether translation is in progress
  isBottomSheetVisible, // Whether bottom sheet is visible
  error, // Current error (if any)
  currentText, // Currently selected/translated text

  enable, // Enable text selection
  disable, // Disable text selection
  translate, // Programmatically translate text
  dismissBottomSheet, // Close the bottom sheet
  cancelTranslation, // Cancel ongoing translation
  clearError, // Clear current error
  addEventListener, // Add event listener
} = useSignLanguage(options);
```

### Example: Programmatic Translation

```tsx
import { useSignLanguage } from 'weaccess-ai-signlanguage';

const MyScreen = () => {
  const { translate, isLoading } = useSignLanguage({
    onTranslationComplete: ({ videoUrl }) =>
      console.log('Video ready:', videoUrl),
    onError: (error) => console.error('Error:', error),
  });

  return (
    <View>
      <Button
        title="Translate"
        onPress={() => translate('Merhaba, nasılsın?')}
        disabled={isLoading}
      />
    </View>
  );
};
```

## 🎨 Theming

Customize the appearance to match your brand:

```tsx
<SignLanguageProvider
  config={{
    apiKey: 'YOUR_API_KEY',
    apiUrl: 'https://api.signfordeaf.com',
    theme: {
      primaryColor: '#6750A4',
      backgroundColor: '#FFFFFF',
      textColor: '#1C1B1F',
      closeButtonColor: '#6750A4',
      videoBackgroundColor: '#000000',
    },
  }}
>
  <App />
</SignLanguageProvider>
```

## ♿ Accessibility

Built with accessibility-first design:

- **VoiceOver (iOS)**: Full screen reader support with proper labels and hints
- **TalkBack (Android)**: Complete accessibility labels and navigation
- **RTL Support**: Right-to-left language support for Arabic
- **Announcements**: Automatic screen reader announcements for translation events

```tsx
<SignLanguageProvider
  config={{
    apiKey: 'YOUR_API_KEY',
    apiUrl: 'https://api.signfordeaf.com',
    accessibility: {
      announceOnOpen: true,
      announceOnClose: false,
      videoPlayerLabel: 'Sign language video playing',
      closeButtonLabel: 'Close video',
    },
  }}
>
  <App />
</SignLanguageProvider>
```

## 📱 Platform Support

| Platform     | Minimum Version       |
| ------------ | --------------------- |
| iOS          | 13.0+                 |
| Android      | API 24+ (Android 7.0) |
| React Native | 0.72+                 |

## 🔧 Advanced Usage

### Event Listeners

Listen to various events throughout the translation lifecycle:

```typescript
const { addEventListener } = useSignLanguage();

useEffect(() => {
  const unsubscribe = addEventListener('onTextSelected', ({ text }) => {
    console.log('User selected:', text);
  });

  return () => unsubscribe();
}, []);
```

### Available Events

| Event                   | Payload                              | Description            |
| ----------------------- | ------------------------------------ | ---------------------- |
| `onTextSelected`        | `{ text: string }`                   | Text was selected      |
| `onTranslationStart`    | `{ text: string }`                   | Translation started    |
| `onTranslationComplete` | `{ text: string, videoUrl: string }` | Translation complete   |
| `onTranslationError`    | `{ code: string, message: string }`  | Translation failed     |
| `onBottomSheetOpen`     | -                                    | Bottom sheet opened    |
| `onBottomSheetClose`    | -                                    | Bottom sheet closed    |
| `onVideoStart`          | -                                    | Video started playing  |
| `onVideoEnd`            | -                                    | Video finished playing |

## 🏗️ Architecture

This library uses React Native's **Native Modules (Classic Bridge)** for maximum compatibility and is designed to be **TurboModule-ready** for future migration.

### Native Components

- **iOS**: Swift with AVPlayer for video playback
- **Android**: Kotlin with ExoPlayer for video playback
- **Text Selection**: Native UITextView delegates (iOS) and ActionMode callbacks (Android)
- **Bottom Sheet**: Native UISheetPresentationController (iOS) and BottomSheetDialogFragment (Android)

## 🤝 Support & Contributing

We welcome contributions! If you encounter issues or have feature requests, please open an issue on our [GitHub repository](https://github.com/signfordeaf/weaccess_ai_signlanguage).

## 📄 License

MIT © [SignForDeaf](https://www.signfordeaf.com)

---

<p align="center">
  <strong>Made with ❤️ for accessibility</strong><br>
  Building a more inclusive digital world
</p>
