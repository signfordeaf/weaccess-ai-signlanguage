/**
 * Feedback and contact.
 *
 * The thumbs-up/down affordance and the contact button are fully implemented in
 * the UI and the event flow, but the endpoints are **stubbed**: one build-time
 * flag says whether they point at a real backend. While it is off, the SDK
 * skips the network call and reports success, so the UI and the events behave
 * correctly end to end and wiring the real endpoints later touches nothing but
 * the constants below.
 *
 * Both calls swallow every failure. Feedback is a side channel; it may never
 * disturb playback.
 */

import { API_CONSTANTS } from '../constants';
import { languageCode, type ResolvedConfig } from '../core/config';

/** Flip to `true` once the endpoints are live. */
export const ENDPOINTS_CONFIGURED = false;

export const VOTE_POSITIVE = '1';
export const VOTE_NEGATIVE = '0';

/** The credential block both calls send alongside their own parameters. */
const credentials = (config: ResolvedConfig): Record<string, string> => ({
  rk: config.apiKey,
  fdid: config.fdid,
  tid: config.tid,
  language: languageCode(config.language),
  url: config.originUrl,
});

const post = async (
  config: ResolvedConfig,
  path: string,
  params: Record<string, string>
): Promise<boolean> => {
  if (!ENDPOINTS_CONFIGURED) return true;

  try {
    const body = new URLSearchParams({ ...credentials(config), ...params });
    const response = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: config.originUrl,
      },
      body: body.toString(),
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Send a vote on a translation.
 *
 * Returns whether it was accepted. A rejected vote rolls back in the UI and
 * emits nothing.
 */
export const sendFeedback = (
  config: ResolvedConfig,
  { cid, text, positive }: { cid: string; text: string; positive: boolean }
): Promise<boolean> =>
  post(config, API_CONSTANTS.FEEDBACK_ENDPOINT, {
    cid,
    s: text,
    vote: positive ? VOTE_POSITIVE : VOTE_NEGATIVE,
  });

/**
 * Ask to be contacted about a translation.
 *
 * The `contactRequested` event fires *before* this call is made, so the host
 * learns about the intent even if the call fails.
 */
export const sendContactRequest = (
  config: ResolvedConfig,
  { cid, text }: { cid: string; text: string }
): Promise<boolean> =>
  post(config, API_CONSTANTS.CONTACT_ENDPOINT, { cid, s: text });
