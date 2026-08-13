/**
 * Player sizing.
 *
 * The player is the only SDK surface that covers the host app, so its size is
 * a contract, not a style choice. This algorithm is normative — reproduce it
 * exactly, or the player will be proportionate on one phone and oversized on
 * another.
 *
 * The key idea is that the *whole player* is budgeted, not just the avatar.
 * The stage height settles at `avatarMaxWidth / aspect` on every screen, so
 * the fixed chrome is what decides whether the player looks proportionate.
 * Capping the avatar alone leaves a compact phone with a player taking over
 * half its height.
 */

import { CAPTION, DEFAULT_ASPECT_RATIO, SIZE, SPACE } from './tokens';

export interface PlayerLayoutInput {
  /** Screen height in points. */
  screenHeight: number;
  /**
   * The playing video's aspect ratio (width / height). Omitted or
   * non-positive before a video reports one, in which case the bundled idle
   * clips' ratio is assumed.
   */
  aspect?: number;
  /**
   * System font scale. Defaults to 1. The caption block grows with this so
   * raising the system text size grows the block instead of clipping the words
   * in it.
   */
  fontScale?: number;
  /** Requested stage height (config `card.avatarHeight`). */
  avatarHeight?: number;
  /** Width ceiling, used when a video turns out landscape (`card.avatarMaxWidth`). */
  avatarMaxWidth?: number;
  /**
   * Number of controls in the expanded bar: play/pause, plus speed, loop and
   * contact when each is enabled. Defaults to 3.
   */
  controlCount?: number;
}

export interface PlayerLayout {
  /** The video/idle-loop area. */
  stageWidth: number;
  stageHeight: number;
  /** Width of the expanded control bar — normally exactly the stage width. */
  barWidth: number;
  /** Reserved height of the caption block, including its padding. */
  captionBlockHeight: number;
  /** How far the window pill hangs above the stage's top edge. */
  pillOverflow: number;
  /** Fixed height the player spends on everything that is not the stage. */
  chromeHeight: number;
  /** Total height of the player, pill overflow included. */
  totalHeight: number;
  /**
   * Total height while there is no caption to draw.
   *
   * The caption block is still *budgeted* above — that is what keeps the stage
   * from resizing the moment text arrives — but it is not drawn until there is
   * a sentence to put in it, so the player's real footprint is this until then.
   */
  compactHeight: number;
  /** Total width — the wider of the stage and the bar. */
  totalWidth: number;
  /** The aspect ratio the stage was sized against. */
  aspect: number;
}

/** Requests, not guarantees — the size budget can shrink both. */
export const DEFAULT_AVATAR_HEIGHT = 240;
export const DEFAULT_AVATAR_MAX_WIDTH = 212;

/**
 * A stage shorter than one control is not a player any more. The spec gives
 * `minStageWidth` as the width floor but names no height floor, so this exists
 * only to keep a pathologically short screen rendering something rather than a
 * zero-height box.
 */
const MIN_STAGE_HEIGHT = SIZE.control;

/**
 * Height the caption reserves.
 *
 * Reserved *before there is a caption*: the player can be open with nothing
 * translated yet, and budgeting the caption only once text arrives would
 * shrink the avatar at the exact moment the user looks at it.
 */
export const captionBlockHeight = (fontScale = 1): number =>
  CAPTION.fontSize * fontScale * CAPTION.lineHeight * CAPTION.maxLines +
  SPACE.sm * 2;

export const computePlayerLayout = ({
  screenHeight,
  aspect: rawAspect,
  fontScale = 1,
  avatarHeight = DEFAULT_AVATAR_HEIGHT,
  avatarMaxWidth = DEFAULT_AVATAR_MAX_WIDTH,
  controlCount = 3,
}: PlayerLayoutInput): PlayerLayout => {
  const aspect =
    rawAspect && rawAspect > 0 && Number.isFinite(rawAspect)
      ? rawAspect
      : DEFAULT_ASPECT_RATIO;

  const captionHeight = captionBlockHeight(fontScale);
  const pillOverflow = SIZE.control * SIZE.pillOverflowFraction;

  const chromeHeight = pillOverflow + SPACE.sm + SIZE.control + captionHeight;

  const available = screenHeight * SIZE.maxPlayerScreenFraction - chromeHeight;

  const stageHeight = Math.max(
    MIN_STAGE_HEIGHT,
    Math.min(avatarHeight, avatarMaxWidth / aspect, available)
  );

  // `minStageWidth` is a floor, not a target. On a short screen the height cap
  // would otherwise squeeze the stage below the width three 44 pt controls
  // need. Widening letterboxes the video by a point or two against the same
  // surface color — invisible in practice — and keeps the bar exactly as wide
  // as the stage.
  const stageWidth = Math.max(stageHeight * aspect, SIZE.minStageWidth);

  // The bar grows rather than clips when an optional control needs more room.
  const barWidth = Math.max(stageWidth, controlCount * SIZE.control);

  return {
    stageWidth,
    stageHeight,
    barWidth,
    captionBlockHeight: captionHeight,
    pillOverflow,
    chromeHeight,
    totalHeight: stageHeight + chromeHeight,
    compactHeight: stageHeight + chromeHeight - captionHeight,
    totalWidth: Math.max(stageWidth, barWidth),
    aspect,
  };
};
