const PREVIEW_SIGN_OUT_TIMEOUT_MS = 1500;

/**
 * @param {Promise<unknown>} operation
 * @param {number} timeoutMs
 * @returns {Promise<unknown>}
 */
function settleWithin(operation, timeoutMs) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * Clear any existing session before starting a new provider sign-in.
 * Preview auth uses a sessionStorage bearer token, so its best-effort server
 * sign-out is bounded. Deployed auth uses an HttpOnly cookie and must finish
 * the server sign-out before the caller starts another OAuth flow.
 *
 * @param {{
 *   livePreview: boolean,
 *   hasBearer: boolean,
 *   requestSignOut: () => Promise<unknown>,
 *   clearToken: () => void
 * }} options
 * @returns {Promise<void>}
 */
export async function runPreSignInSignOut({
  livePreview,
  hasBearer,
  requestSignOut,
  clearToken,
}) {
  if (livePreview) {
    if (hasBearer) {
      try {
        await settleWithin(Promise.resolve().then(requestSignOut), PREVIEW_SIGN_OUT_TIMEOUT_MS);
      } catch {
        // Clearing the preview's local bearer token is sufficient.
      }
    }
    clearToken();
    return;
  }

  await requestSignOut();
  clearToken();
}

/**
 * Sign out and redirect. In preview the local bearer token is authoritative;
 * in deployed mode only the server can clear the HttpOnly session cookie.
 *
 * @param {{
 *   livePreview: boolean,
 *   hasBearer: boolean,
 *   requestSignOut: () => Promise<unknown>,
 *   clearToken: () => void,
 *   redirect: () => void
 * }} options
 * @returns {Promise<void>}
 */
export async function runSignOut({
  livePreview,
  hasBearer,
  requestSignOut,
  clearToken,
  redirect,
}) {
  if (livePreview) {
    if (hasBearer) {
      try {
        await settleWithin(Promise.resolve().then(requestSignOut), PREVIEW_SIGN_OUT_TIMEOUT_MS);
      } catch {
        // The preview session is cleared locally below.
      }
    }
    clearToken();
    redirect();
    return;
  }

  // Do not report success or navigate away until the server confirms logout.
  await requestSignOut();
  clearToken();
  redirect();
}
