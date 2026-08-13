/**
 * The bundled idle-signer clips.
 *
 * They are produced the same way for every port: the clip's own reverse
 * concatenated onto its end (so plain looping reads as smooth back-and-forth
 * motion), 540 px, 900x828, audio stripped — about 184 KB for all four.
 *
 * The aspect ratio matters as much as the content: it matches the real
 * translation videos, so the stage keeps its size from the first idle frame
 * through to playback instead of resizing under the user.
 *
 * Until the files are present every lookup returns `null`, and the player takes
 * the documented failure path — a plain spinner while loading, the tinted mark
 * while idle. A decorative loop is never worth an error.
 */

import type { TranslatorId } from '../types';

/** What `require()` of a bundled asset evaluates to on React Native. */
export type AssetSource = number;

const ASSETS: Partial<Record<TranslatorId, AssetSource>> = {
  kadir: require('../assets/videos/placeholder-kadir.mp4'),
  hesna: require('../assets/videos/placeholder-hesna.mp4'),
  jason: require('../assets/videos/placeholder-jason.mp4'),
  owais: require('../assets/videos/placeholder-owais.mp4'),
};

/** Whether any clip is bundled at all. */
export const hasBundledClips = (): boolean => Object.keys(ASSETS).length > 0;

export const placeholderAssetFor = (signer: TranslatorId): AssetSource | null =>
  ASSETS[signer] ?? null;
