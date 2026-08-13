/**
 * The translation backend.
 *
 * `GET /Translate` is the only call required for a working SDK. This module
 * replaces the OkHttp client on Android and the URLSession one on iOS, so both
 * platforms now poll, cancel and assemble URLs identically.
 */

import { API_CONSTANTS } from '../constants';
import { languageCode, type ResolvedConfig } from '../core/config';
import { parseServedId } from '../core/signers';

/** The shape the backend returns. */
export interface SignModel {
  state: boolean | null;
  baseUrl: string | null;
  name: string | null;
  cid: string | null;
  st: boolean | null;
  /** Present only when the backend served the translation under another pair. */
  tid: string | null;
  fdid: string | null;
}

export interface TranslateResult {
  /** `baseUrl + name`, forced to https. */
  videoUrl: string;
  cid?: string;
  /** Ids the response came back under, if it named any. */
  servedTid?: string;
  servedFdid?: string;
}

export type TranslateFailure =
  | { kind: 'cancelled' }
  /** The request threw — transport failure, timeout. */
  | { kind: 'network'; message: string }
  /** The response arrived without a usable video, polling exhaustion included. */
  | { kind: 'api'; message: string; status?: number };

export type TranslateOutcome =
  | { ok: true; value: TranslateResult }
  | { ok: false; error: TranslateFailure };

/** How a caller aborts an in-flight translation. */
export interface TranslateOptions {
  signal?: AbortSignal;
}

/**
 * The rejection an aborted wait produces.
 *
 * `DOMException` is a browser global that Hermes does not define, so building
 * one threw a `ReferenceError` from inside the `abort` listener below. Because
 * that throw escapes the listener rather than rejecting, the wait never settled
 * at all and `translateSegment` hung for good — cancelling a translation on a
 * device left the request pending forever. Node defines the global, which is
 * why the suite never caught it.
 *
 * A plain `Error` carrying the same `name` is what `isAbort` matches on, and it
 * is what `fetch` itself rejects with here.
 */
export const abortError = (): Error => {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
};

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const isAbort = (error: unknown): boolean =>
  (error as { name?: string })?.name === 'AbortError';

/**
 * Assemble the video URL.
 *
 * Simple concatenation, no separator inserted. The `http:` rewrite replaces
 * only the first occurrence and only the scheme prefix — it exists because the
 * backend may hand back an `http:` URL that mobile platforms refuse to load
 * under their transport-security defaults.
 */
export const buildVideoUrl = (baseUrl: string, name: string): string =>
  `${baseUrl}${name}`.replace('http:', 'https:');

export const buildTranslateUrl = (
  config: ResolvedConfig,
  text: string
): string => {
  const params = new URLSearchParams({
    s: text,
    rk: config.apiKey,
    fdid: config.fdid,
    tid: config.tid,
    language: languageCode(config.language),
    // The origin is sent twice — here and as the `Origin` header — and both
    // must carry the same value.
    url: config.originUrl,
  });

  return `${config.apiUrl}${
    API_CONSTANTS.TRANSLATE_ENDPOINT
  }?${params.toString()}`;
};

const parseModel = (raw: unknown): SignModel => {
  const body = (raw ?? {}) as Record<string, unknown>;
  return {
    state: typeof body.state === 'boolean' ? body.state : null,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : null,
    name: typeof body.name === 'string' ? body.name : null,
    cid: body.cid == null ? null : String(body.cid),
    st: typeof body.st === 'boolean' ? body.st : null,
    tid: parseServedId(body.tid),
    fdid: parseServedId(body.fdid),
  };
};

/** One request, with its own timeout, chained onto the caller's signal. */
const requestOnce = async (
  url: string,
  origin: string,
  signal: AbortSignal | undefined
): Promise<{ model: SignModel } | { failure: TranslateFailure }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONSTANTS.TIMEOUT_MS);
  const forward = () => controller.abort();
  signal?.addEventListener('abort', forward, { once: true });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Origin: origin },
      signal: controller.signal,
    });

    if (!response.ok) {
      // The specific code travels on the event for hosts that want to log it;
      // the user always sees the localized generic failure string.
      return {
        failure: {
          kind: 'api',
          message: `HTTP ${response.status}`,
          status: response.status,
        },
      };
    }

    return { model: parseModel(await response.json()) };
  } catch (error) {
    if (signal?.aborted) return { failure: { kind: 'cancelled' } };
    return {
      failure: {
        kind: 'network',
        message: (error as Error)?.message ?? 'Request failed',
      },
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
};

/**
 * Translate one segment.
 *
 * `state: false` means the video is still being rendered, so the same request
 * repeats every second for up to 30 attempts. A cold segment can therefore
 * cost half a minute — which is why prefetching one sentence ahead matters so
 * much.
 *
 * Never throws: every outcome, cancellation included, comes back as a value.
 */
export const translateSegment = async (
  config: ResolvedConfig,
  text: string,
  { signal }: TranslateOptions = {}
): Promise<TranslateOutcome> => {
  const url = buildTranslateUrl(config, text);

  for (let attempt = 0; attempt < API_CONSTANTS.MAX_RETRIES; attempt++) {
    if (signal?.aborted) return { ok: false, error: { kind: 'cancelled' } };

    const outcome = await requestOnce(url, config.originUrl, signal);
    if ('failure' in outcome) return { ok: false, error: outcome.failure };

    const { model } = outcome;

    if (model.state === true) {
      // A response without a video is not a video.
      if (!model.baseUrl || !model.name) {
        return {
          ok: false,
          error: { kind: 'api', message: 'Response carried no video' },
        };
      }

      return {
        ok: true,
        value: {
          videoUrl: buildVideoUrl(model.baseUrl, model.name),
          ...(model.cid ? { cid: model.cid } : {}),
          ...(model.tid ? { servedTid: model.tid } : {}),
          ...(model.fdid ? { servedFdid: model.fdid } : {}),
        },
      };
    }

    // Still rendering. Wait and repeat the same request.
    try {
      await sleep(API_CONSTANTS.RETRY_DELAY_MS, signal);
    } catch (error) {
      if (isAbort(error)) return { ok: false, error: { kind: 'cancelled' } };
      throw error;
    }
  }

  // Exhaustion is treated as *no translation available*, and nothing is cached.
  return {
    ok: false,
    error: { kind: 'api', message: 'Translation timed out while rendering' },
  };
};
