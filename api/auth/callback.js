import {
  clearOAuthCookies,
  clearSessionCookie,
  decodeJwtPayload,
  getAllowedEmail,
  getBaseUrl,
  getOAuthCookies,
  setSessionCookie,
} from '../_lib/auth.js';

function redirectWithError(res, message) {
  res.redirect(`/?admin=1&auth_error=${encodeURIComponent(message)}`);
}

export default async function handler(req, res) {
  try {
    const clientId = process.env.VERCEL_APP_CLIENT_ID?.trim();
    const clientSecret = process.env.VERCEL_APP_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: 'Vercel OAuth env vars are not configured' });
    }

    const { code, state, error, error_description: errorDescription } = req.query;
    if (error) {
      clearOAuthCookies(res);
      clearSessionCookie(res);
      return redirectWithError(res, errorDescription || String(error));
    }

    const cookies = getOAuthCookies(req);
    if (!code || Array.isArray(code) || !state || Array.isArray(state)) {
      clearOAuthCookies(res);
      return redirectWithError(res, 'Missing OAuth callback parameters');
    }
    if (!cookies.state || !cookies.codeVerifier || !cookies.nonce || cookies.state !== state) {
      clearOAuthCookies(res);
      clearSessionCookie(res);
      return redirectWithError(res, 'OAuth state validation failed');
    }

    const redirectUri = `${getBaseUrl(req)}/api/auth/callback`;
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: cookies.codeVerifier,
    });

    const tokenResponse = await fetch('https://api.vercel.com/login/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokenPayload = await tokenResponse.json();
    const idToken = tokenPayload.id_token;
    const accessToken = tokenPayload.access_token;
    if (!idToken || !accessToken) {
      throw new Error('Missing id_token or access_token from Vercel');
    }

    const idClaims = decodeJwtPayload(idToken);
    if (idClaims.nonce !== cookies.nonce) {
      clearOAuthCookies(res);
      clearSessionCookie(res);
      return redirectWithError(res, 'OAuth nonce validation failed');
    }

    const userInfoResponse = await fetch('https://api.vercel.com/login/oauth/userinfo', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      const text = await userInfoResponse.text();
      throw new Error(`Failed to load Vercel user info: ${text}`);
    }

    const user = await userInfoResponse.json();
    const email = String(user.email || '').toLowerCase();
    if (!email || email !== getAllowedEmail() || user.email_verified === false) {
      clearOAuthCookies(res);
      clearSessionCookie(res);
      return redirectWithError(res, 'This Vercel account is not allowed to administer this app');
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 8;

    setSessionCookie(res, {
      sub: user.sub,
      email,
      name: user.name || null,
      picture: user.picture || null,
      exp,
    });
    clearOAuthCookies(res);

    return res.redirect('/?admin=1');
  } catch (err) {
    console.error('/api/auth/callback error', err);
    clearOAuthCookies(res);
    clearSessionCookie(res);
    return redirectWithError(res, err.message || 'Authentication failed');
  }
}
