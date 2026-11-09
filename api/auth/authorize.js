import { createPkceBundle, getBaseUrl, getRequestOrigin, setOAuthCookies } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const clientId = process.env.VERCEL_APP_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(500).json({ message: 'VERCEL_APP_CLIENT_ID not set' });
    }

    // The OAuth cookies are host-only, so the whole flow (authorize, callback,
    // session) has to live on one origin: the canonical base URL. If the
    // sign-in click started on another host (e.g. the vercel.app alias while
    // APP_BASE_URL is the custom domain, or vice versa), restart the flow on
    // the canonical origin BEFORE any cookies are set. Without this, the
    // callback lands on the canonical host without the state cookies and
    // fails with "OAuth state validation failed" on the first attempt.
    const baseUrl = getBaseUrl(req);
    const requestOrigin = getRequestOrigin(req);
    if (requestOrigin && baseUrl && requestOrigin !== baseUrl) {
      return res.redirect(`${baseUrl}/api/auth/authorize`);
    }

    const { state, nonce, codeVerifier, codeChallenge } = createPkceBundle();
    const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;

    setOAuthCookies(res, { state, nonce, codeVerifier });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    res.redirect(`https://vercel.com/oauth/authorize?${params.toString()}`);
  } catch (err) {
    console.error('/api/auth/authorize error', err);
    res.status(500).json({ message: err.message });
  }
}
