# Contributing to React Native Sign Language Translation

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 18+
- Yarn
- Xcode 14+ (for iOS development)
- Android Studio (for Android development)
- React Native CLI

### Getting Started

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/weaccess-ai-signlanguage.git
   cd weaccess-ai-signlanguage
   ```

3. Run the bootstrap script:

   ```bash
   chmod +x scripts/bootstrap.sh
   ./scripts/bootstrap.sh
   ```

4. Start developing!

## Project Structure

```
├── src/                    # TypeScript source files
│   ├── index.ts           # Main entry point
│   ├── types.ts           # Type definitions
│   ├── NativeSignLanguage.ts
│   ├── SignLanguageProvider.tsx
│   ├── useSignLanguage.ts
│   └── components/
├── ios/                    # iOS native code (Swift)
│   └── SignLanguageTranslation/
├── android/                # Android native code (Kotlin)
│   └── src/main/java/
├── example/                # Example React Native app
├── scripts/                # Build and test scripts
└── lib/                    # Built JavaScript files
```

## Making Changes

### TypeScript/JavaScript

1. Make your changes in `src/`
2. Run type check: `yarn typescript`
3. Run linting: `yarn lint`
4. Build: `yarn prepare`

### iOS Native Code

1. Edit Swift files in `ios/SignLanguageTranslation/`
2. Test in the example app: `cd example && yarn ios`

### Android Native Code

1. Edit Kotlin files in `android/src/main/java/`
2. Test in the example app: `cd example && yarn android`

## Testing

Run all tests:

```bash
yarn test
```

Run the example app:

```bash
cd example
yarn ios     # For iOS
yarn android # For Android
```

## Code Style

- Use TypeScript for JavaScript code
- Use Swift for iOS native code
- Use Kotlin for Android native code
- Follow existing code formatting
- Run `yarn lint` before committing

## Commit Messages

Use conventional commit format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

Example:

```
feat: add support for custom theme colors
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Update documentation if needed
4. Ensure all tests pass
5. Submit a pull request

## Reporting Issues

When reporting issues, please include:

- React Native version
- iOS/Android version
- Device/Simulator info
- Steps to reproduce
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
