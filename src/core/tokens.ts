/**
 * Design tokens — every value the SDK's own surfaces are drawn from.
 *
 * Brand colors are deliberately NOT here: they come from the integration's
 * theme so each app keeps its palette. Everything in this file is fixed, so
 * the player, the control bar, the pills and the hint bubble stay visually one
 * system across platforms.
 *
 * All sizes are in points (dp / pt / density-independent units).
 */

/**
 * Radii. Deliberately small — large radii on a surface this size read as a
 * chunky block rather than a compact player.
 */
export const RADIUS = {
  /** Stage and control bar outer radius (overridable via theme `cornerRadius`). */
  large: 16,
  /** Action pills — feedback, collapse/close. */
  medium: 12,
  /** Speed button, hint bubble, logo badge. */
  small: 8,
} as const;

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/**
 * `controlSize` is one value for every control on purpose: hierarchy comes
 * from the icon inside, not from differently sized boxes. It is also the
 * platform accessibility minimum, which is not negotiable in an SDK built for
 * accessibility — never shrink an individual control to fit a layout, widen
 * the container instead.
 */
export const SIZE = {
  /** Tap target of every control and pill button. */
  control: 44,
  /**
   * Icon inside a control.
   *
   * These were 20 and 24. On device both read a size too large against the
   * speed chip, so they are a step down here. Purely visual — the 44 pt tap
   * target is untouched, so nothing about accessibility changes.
   */
  icon: 18,
  /** Play/pause glyph, and the mark in the collapsed bar. */
  primaryIcon: 20,
  /** How much of the window pill hangs above the stage. */
  pillOverflowFraction: 0.8,
  /** Narrowest the stage may get: 3 * 44 + 8. */
  minStageWidth: 140,
  /** Share of screen height the whole player may occupy. */
  maxPlayerScreenFraction: 0.42,
} as const;

/** Width of the collapsed bar: mark + expand + close, at 44 pt each. */
export const COLLAPSED_BAR_WIDTH = 3 * SIZE.control;

/**
 * Aspect ratio assumed before a video reports one. Matches the bundled idle
 * clips (900x828), which come off the same production pipeline as real
 * translations — so the stage keeps its size from the first frame of the idle
 * loop through to playback instead of resizing under the user.
 */
export const DEFAULT_ASPECT_RATIO = 900 / 828;

export const LOADING = {
  /** Gaussian blur over the idle avatar while a translation is in flight. */
  blurSigma: 2.5,
  /** Spinner diameter over the blurred avatar. */
  indicatorSize: 24,
  /** Spinner stroke width. */
  indicatorStroke: 2.5,
} as const;

export const CAPTION = {
  fontSize: 12,
  /** Multiplier, not an absolute line height. */
  lineHeight: 1.35,
  maxLines: 2,
  /** Auto-scroll speed in points per second. */
  scrollSpeed: 16,
  /** How long the caption rests at each end before travelling. */
  holdMs: 1600,
  /** Travel duration is clamped into this range. */
  minTravelMs: 400,
  maxTravelMs: 8000,
  /** Rewind to the top. */
  rewindMs: 450,
  /** Auto-scroll resumes this long after the user stops scrolling by hand. */
  resumeAfterManualMs: 4000,
} as const;

export const MOTION = {
  /** Player enter/exit. */
  cardTransitionMs: 320,
  /** Collapse/expand. */
  collapseTransitionMs: 260,
  /** Drag-release settle of the player and the floating button. */
  snapTransitionMs: 300,
} as const;

/**
 * Elevation. `floatingShadow` sits under the stage and the control bar;
 * `pillShadow` under anything laid on top of them, and under the floating
 * button.
 *
 * Expressed as React Native style fragments so views can spread them directly.
 * `elevation` is the Android approximation of the same visual weight.
 */
export const SHADOW = {
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 6,
  },
  pill: {
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
} as const;

/**
 * Neutral overlays. These are intentionally NOT themeable — they sit over
 * unpredictable content (video frames, the host app) where a brand color
 * cannot be trusted to stay legible.
 */
export const OVERLAY = {
  /** Fill behind the speed button, over the primary bar. */
  controlFill: 'rgba(255, 255, 255, 0.12)',
  /** Speed button border. */
  controlBorder: 'rgba(255, 255, 255, 0.35)',
  /** Any control that is currently unavailable. */
  disabledOpacity: 0.4,
} as const;

/** The floating button. */
export const FLOATING_BUTTON = {
  size: 44,
  /** Logo edge length, as a fraction of the button size. */
  logoFraction: 0.6,
  /** Border width, drawn only while tap mode is off. */
  borderWidth: 2,
  /** Movement below which a gesture is a tap rather than a drag. */
  tapSlop: 6,
  /** Fraction of the button hidden past the edge while idle. */
  peekHiddenFraction: 0.35,
  /** Inactivity before the idle behavior starts. */
  idleDelayMs: 2500,
  /** Opacity the button fades to while idle. */
  idleOpacity: 0.55,
} as const;

/** Mark size and tint used when the idle clip cannot be played. */
export const IDLE_FALLBACK_MARK = {
  size: 32,
  /** Fraction of the primary color the mark is tinted at. */
  opacity: 0.35,
} as const;
