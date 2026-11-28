/** Saving remote files on the user's device. No domain knowledge. */

/**
 * Downloads `url` as `fileName`. A cross-origin link with `download` is ignored by browsers, so the
 * file is fetched first (Firebase Storage needs the bucket CORS policy for this). When the fetch is
 * not possible, the file opens in a new tab so the user can still save it.
 * @returns {Promise<'downloaded' | 'opened'>}
 */
export async function downloadUrl(url, fileName) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement('a'), { href: objectUrl, download: fileName });
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoked later: some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return 'downloaded';
  } catch (error) {
    console.warn('[VintoCentral] download fell back to a new tab', error);
    window.open(url, '_blank', 'noopener,noreferrer');
    return 'opened';
  }
}
