import { handleUpload } from '@vercel/blob/client';
import { requireAdmin } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!requireAdmin(req, res)) return;

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const jsonResponse = await handleUpload({
      token: process.env.BLOB_READ_WRITE_TOKEN,
      request: req,
      body,
      onBeforeGenerateToken: async (pathname, _clientPayload, multipart) => ({
        allowedContentTypes: ['audio/*', 'video/mp4'],
        maximumSizeInBytes: 1024 * 1024 * 1024,
        addRandomSuffix: false,
        allowOverwrite: true,
        validUntil: Date.now() + 60 * 60 * 1000,
        tokenPayload: null,
      }),
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('blob upload error', err);
    return res.status(500).json({ message: err.message });
  }
}
