import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default async function (req, res) {
  try {
    // Simple auth: only allow when x-admin-token matches SERVER ADMIN_TOKEN
    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
    if (ADMIN_TOKEN) {
      const headerToken = req.headers['x-admin-token'] || req.headers['x-admin-token'];
      if (!headerToken || headerToken !== ADMIN_TOKEN) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).end();
    }

    const { fileName, contentType } = req.body || {};
    if (!fileName) return res.status(400).json({ message: 'fileName required' });

    const bucket = process.env.S3_BUCKET;
    if (!bucket) return res.status(500).json({ message: 'S3_BUCKET not configured' });

    const region = process.env.S3_REGION;
    const endpoint = process.env.S3_ENDPOINT; // optional for R2/backblaze

    const s3Client = new S3Client({ region, endpoint, forcePathStyle: !!endpoint, credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }});

    const key = fileName;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // Public URL construction: allow override via STORAGE_PUBLIC_BASE_URL
    let publicUrl = process.env.STORAGE_PUBLIC_BASE_URL;
    if (!publicUrl) {
      if (endpoint) {
        publicUrl = `${endpoint}/${bucket}/${encodeURIComponent(key)}`;
      } else if (region) {
        publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`;
      } else {
        publicUrl = `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(key)}`;
      }
    } else {
      publicUrl = `${publicUrl.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
    }

    return res.json({ url, publicUrl });
  } catch (err) {
    console.error('presign error', err);
    return res.status(500).json({ message: 'Failed to create presigned url' });
  }
}
