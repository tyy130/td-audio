const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

export const extractEmbeddedCoverArt = async (file: File): Promise<string | undefined> => {
  try {
    const { parseBuffer, selectCover } = await import('music-metadata');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const metadata = await parseBuffer(bytes, {
      mimeType: file.type || undefined,
      size: file.size,
    });
    const cover = selectCover(metadata.common.picture ?? []);

    if (!cover?.data?.length || !cover.format) {
      return undefined;
    }

    const coverBytes = cover.data instanceof Uint8Array ? cover.data : new Uint8Array(cover.data);
    return `data:${cover.format};base64,${toBase64(coverBytes)}`;
  } catch (error) {
    console.warn('Unable to extract embedded album art', error);
    return undefined;
  }
};
