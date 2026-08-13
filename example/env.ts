/**
 * Build-time configuration.
 *
 * The API key and the URL parameters are never committed. They come from the
 * build environment — either the shell that starts Metro or the gitignored
 * `example/.env` file on this machine — and Babel inlines them into the bundle
 * as plain string literals at transform time (see babel.config.js). By the time
 * the app runs there is no `process.env` lookup left; the values are constants
 * baked into the bundle for *this* build.
 *
 * Copy `.env.example` to `.env` and fill it in, or export the same names in
 * your shell before `yarn start`. Shell values win over the file.
 *
 * After changing `.env`, restart Metro with `yarn start --reset-cache` — the
 * old values are otherwise still cached in the transform cache.
 */

// Only the build-time reads below need this; the app itself never touches
// `process`, because Babel has already replaced these lookups with literals.
declare const process: { env: Record<string, string | undefined> };

/** Reads an inlined variable; `undefined` when it was not defined at build time. */
const read = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const apiKey = read(process.env.SFD_API_KEY);
const apiUrl = read(process.env.SFD_API_URL);

if (__DEV__ && (!apiKey || !apiUrl)) {
  console.warn(
    '[example] SFD_API_KEY / SFD_API_URL are not set for this build.\n' +
      'Copy example/.env.example to example/.env (or export them in your shell) ' +
      'and restart Metro with `yarn start --reset-cache`.'
  );
}

/**
 * The credential half of the SDK config. Spread into the config object in
 * App.tsx; everything else there (theme, language, behaviour) is plain code.
 */
export const SDK_ENV = {
  apiKey: apiKey ?? '',
  apiUrl: apiUrl ?? '',
  /** Identifies the app to the backend; defaults to `apiUrl` inside the SDK. */
  originUrl: read(process.env.SFD_ORIGIN_URL),
  /** Form/Domain id (`fdid`); the SDK's own default applies when unset. */
  fdid: read(process.env.SFD_FDID),
  /** Translation id (`tid`); the SDK's own default applies when unset. */
  tid: read(process.env.SFD_TID),
};

/** True when this build actually carries credentials. */
export const HAS_CREDENTIALS = !!apiKey && !!apiUrl;
