import { createPkceBundle, getBaseUrl, setOAuthCookies } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    const clientId = process.env.VERCEL_APP_CLIENT_ID?.trim();
    if (!clientId) {
      return res.status(500).json({ message: 'VERCEL_APP_CLIENT_ID not set' });
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
