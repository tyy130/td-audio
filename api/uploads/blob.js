import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const filename = searchParams.get('filename');

    if (!filename) {
      return res.status(400).json({ message: 'filename query param required' });
    }

    const contentType = req.headers['content-type'] || 'audio/mpeg';
    
    const blob = await put(filename, req, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
    });

    return res.status(200).json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('blob upload error', err);
    return res.status(500).json({ message: err.message });
  }
}
