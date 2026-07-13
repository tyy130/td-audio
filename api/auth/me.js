import { readSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    user: {
      email: session.email,
      name: session.name || null,
      picture: session.picture || null,
    },
  });
}
