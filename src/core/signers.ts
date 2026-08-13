/**
 * The bundled translators, and the idle loop that follows them.
 *
 * While a translation is being fetched the player does not show a spinner on
 * an empty stage. It shows a **signer**, looping, blurred, with a small spinner
 * over it.
 *
 * The idle signer must follow the ids in use. A fixed default avatar looped one
 * person while the translation came back in another's hands: two different
 * people signing the same sentence, seconds apart.
 */

import type { TranslatorId } from '../types';

export interface Signer {
  id: TranslatorId;
  /** Translator id — *which signer* performs the translation. */
  tid: string;
  /** Dictionary id — *which vocabulary* the signer works from. */
  fdid: string;
  /**
   * Informational only. What decides the sign language is the id pair; this is
   * not the same axis as the configured `language`, which names the *spoken*
   * language of the source text — BSL and ASL both sit under English there.
   */
  signLanguage: 'TSL' | 'BSL' | 'ASL';
  /** File name of the bundled clip. */
  asset: string;
}

export const SIGNERS: Record<TranslatorId, Signer> = {
  kadir: {
    id: 'kadir',
    tid: '23',
    fdid: '16',
    signLanguage: 'TSL',
    asset: 'placeholder-kadir.mp4',
  },
  hesna: {
    id: 'hesna',
    tid: '43',
    fdid: '35',
    signLanguage: 'TSL',
    asset: 'placeholder-hesna.mp4',
  },
  jason: {
    id: 'jason',
    tid: '44',
    fdid: '36',
    signLanguage: 'BSL',
    asset: 'placeholder-jason.mp4',
  },
  owais: {
    id: 'owais',
    tid: '37',
    fdid: '29',
    signLanguage: 'ASL',
    asset: 'placeholder-owais.mp4',
  },
};

export const ALL_SIGNERS: Signer[] = Object.values(SIGNERS);

/**
 * The stand-in when nothing resolves. Never a bare spinner — a decorative loop
 * is worth more than an empty stage.
 */
export const FALLBACK_SIGNER = SIGNERS.hesna;

/** Empty strings count as absent. */
const present = (id: string | null | undefined): string | null => {
  const trimmed = id?.trim();
  return trimmed ? trimmed : null;
};

export interface SignerQuery {
  tid?: string | null;
  fdid?: string | null;
}

/**
 * Resolve which signer the idle loop shows.
 *
 * The ids are the only input, and deliberately so: `translator` is resolved
 * into a pair at configuration time, so there is nothing left to pin the loop
 * against the ids the translation actually comes back under.
 *
 * `tid` wins over `fdid` when the two disagree, because `tid` *is* the
 * translator while `fdid` only selects the vocabulary they sign from. A custom
 * dictionary against a known translator is a real integration; the person on
 * screen is the translator either way.
 */
export const resolveSigner = ({ tid, fdid }: SignerQuery): Signer => {
  const wantedTid = present(tid);
  const wantedFdid = present(fdid);
  if (!wantedTid && !wantedFdid) return FALLBACK_SIGNER;

  const exact = ALL_SIGNERS.find(
    (signer) => signer.tid === wantedTid && signer.fdid === wantedFdid
  );
  if (exact) return exact;

  const byTid = wantedTid
    ? ALL_SIGNERS.find((signer) => signer.tid === wantedTid)
    : undefined;
  if (byTid) return byTid;

  const byFdid = wantedFdid
    ? ALL_SIGNERS.find((signer) => signer.fdid === wantedFdid)
    : undefined;
  if (byFdid) return byFdid;

  return FALLBACK_SIGNER;
};

/**
 * Read `tid`/`fdid` off a response leniently.
 *
 * The API is not consistent about quoting them, so both `"44"` and `44` must
 * parse to the same value. The SDK keeps ids as strings everywhere.
 */
export const parseServedId = (value: unknown): string | null => {
  if (typeof value === 'string') return present(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};
