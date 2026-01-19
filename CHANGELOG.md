# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
