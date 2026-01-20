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

### 1. Enable Global Selectable Text & Wrap Your App

```tsx
import React from 'react';
import {
  SignLanguageProvider,
  enableGlobalSelectableText,
} from 'weaccess-ai-signlanguage';

// ⚠️ Important: Call this ONCE before app renders
// This makes ALL Text components in the app selectable automatically
enableGlobalSelectableText();

// SDK Configuration
const SDK_CONFIG = {
  apiKey: 'YOUR_API_KEY', // Your API key (rk parameter)
  apiUrl: 'YOUR_API_URL', // Your API URL
  language: 'tr' as const, // 'tr' | 'en' | 'de' | 'fr' | 'es' | 'ar'
  fdid: 'FIRSTLY_DIC_ID', // Firstly Dictionary ID
  tid: 'TRANSLATOR_ID', // Translator ID
  theme: {
    primaryColor: '#6750A4',
    backgroundColor: '#FFFFFF',
    textColor: '#1C1B1F',
  },
  accessibility: {
    enabled: true,
    announceTranslations: true,
    highContrastMode: false,
  },
};

const App = () => {
  return (
    <SignLanguageProvider
      config={SDK_CONFIG}
      onReady={() => console.log('SDK ready!')}
      onError={(error) => console.error('SDK error:', error)}
    >
      <MainScreen />
    </SignLanguageProvider>
  );
};

export default App;
```

### 2. Use the Hook & Enable Translation

**⚠️ Important:** You must call `enable()` to activate the sign language translation feature!

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSignLanguageContext } from 'weaccess-ai-signlanguage';

const MainScreen = () => {
  // Get state and methods from context
  const { state, enable, disable, translate } = useSignLanguageContext();
  const { isEnabled, isLoading, isConfigured, error } = state;

  // Enable sign language translation
  const handleEnable = () => {
    try {
      enable();
      Alert.alert('Success', 'Sign language translation enabled!');
    } catch (err) {
      console.error('Enable failed:', err);
    }
  };

  // Disable sign language translation
  const handleDisable = () => {
    try {
      disable();
      Alert.alert('Info', 'Sign language translation disabled');
    } catch (err) {
      console.error('Disable failed:', err);
    }
  };

  // Programmatic translation
  const handleManualTranslate = async (text: string) => {
    try {
      await translate(text);
    } catch (err) {
      console.error('Translation failed:', err);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {/* Status */}
      <Text>
        SDK Status: {isConfigured ? '✅ Configured' : '❌ Not Configured'}
      </Text>
      <Text>Translation: {isEnabled ? '✅ Enabled' : '⏸️ Disabled'}</Text>

      {/* Control Buttons */}
      <TouchableOpacity
        onPress={handleEnable}
        disabled={isEnabled || !isConfigured}
        style={{
          padding: 15,
          backgroundColor: '#6750A4',
          marginTop: 20,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          Enable Translation
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleDisable}
        disabled={!isEnabled}
        style={{
          padding: 15,
          backgroundColor: '#E8DEF8',
          marginTop: 10,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: '#6750A4', textAlign: 'center' }}>
          Disable Translation
        </Text>
      </TouchableOpacity>

      {/* Sample Texts - Long press to translate */}
      <View style={{ marginTop: 30 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          Sample Texts (Long press to translate):
        </Text>

        <Text
          selectable={true}
          style={{ padding: 10, backgroundColor: '#F3EDF7', marginBottom: 8 }}
        >
          Hello!
        </Text>

        <Text
          selectable={true}
          style={{ padding: 10, backgroundColor: '#F3EDF7', marginBottom: 8 }}
        >
          Today weather is very good.
        </Text>
      </View>

      {/* Quick Translate Buttons */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 20,
        }}
      >
        {['Merhaba', 'Teşekkürler', 'Evet', 'Hayır'].map((text) => (
          <TouchableOpacity
            key={text}
            onPress={() => handleManualTranslate(text)}
            disabled={!isEnabled}
            style={{
              padding: 10,
              backgroundColor: '#E8DEF8',
              borderRadius: 20,
            }}
          >
            <Text style={{ color: '#6750A4' }}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
```

### 3. How It Works 🎉

1. **Enable the feature** by calling `enable()` from `useSignLanguageContext`
2. **Long-press any text** in your app
3. **Select "İşaret Dili"** (Sign Language) from the context menu
4. **Watch the sign language video** in the bottom sheet

## 📖 API Reference

### SignLanguageProvider

| Prop         | Type                                 | Required | Default | Description              |
| ------------ | ------------------------------------ | -------- | ------- | ------------------------ |
| `config`     | `SignLanguageConfig`                 | Yes      | -       | SDK configuration        |
| `onReady`    | `() => void`                         | No       | -       | Called when SDK is ready |
| `onError`    | `(error: SignLanguageError) => void` | No       | -       | Called on errors         |
| `autoEnable` | `boolean`                            | No       | `false` | Auto-enable on mount     |

### SignLanguageConfig

```typescript
interface SignLanguageConfig {
  apiKey: string; // Your SignForDeaf API key (rk parameter)
  apiUrl: string; // API base URL
  language?: 'tr' | 'en' | 'ar'; // Translation language (default: 'tr')
  fdid?: string; // Form/Domain ID
  tid?: string; // Translation ID
  theme?: SignLanguageTheme; // Theme customization
  accessibility?: AccessibilityConfig;
}
```

### useSignLanguageContext Hook (Recommended)

This is the primary hook to use within components wrapped by `SignLanguageProvider`.

```typescript
import { useSignLanguageContext } from 'weaccess-ai-signlanguage';

const { state, enable, disable, translate } = useSignLanguageContext();

// State object
const {
  isEnabled, // boolean - Whether translation is enabled
  isLoading, // boolean - Whether translation is in progress
  isConfigured, // boolean - Whether SDK is properly configured
  error, // Error | null - Current error if any
} = state;

// Methods
enable(); // ⚠️ REQUIRED: Enable sign language translation
disable(); // Disable sign language translation
translate('Hello world'); // Programmatically translate text
```

#### ⚠️ Important: You Must Call `enable()`

The sign language menu won't appear until you call `enable()`. Typically you should:

```tsx
// Option 1: Enable on button press
<TouchableOpacity onPress={() => enable()}>
  <Text>Enable Sign Language</Text>
</TouchableOpacity>

// Option 2: Enable on component mount
useEffect(() => {
  if (state.isConfigured && !state.isEnabled) {
    enable();
  }
}, [state.isConfigured]);

// Option 3: Enable automatically via provider
<SignLanguageProvider config={config} autoEnable={true}>
```

### useSignLanguage Hook (Alternative)

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

We welcome contributions! If you encounter issues or have feature requests, please open an issue on our [GitHub repository](https://github.com/signfordeaf/weaccess-ai-signlanguage).

## 📄 License

MIT © [SignForDeaf](https://www.signfordeaf.com)

---

<p align="center">
  <strong>Made with ❤️ for accessibility</strong><br>
  Building a more inclusive digital world
</p>
