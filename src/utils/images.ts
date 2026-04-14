/**
 * Basic URL normalization. 
 * Most of the heavy lifting is now done by ImageService and the FirebaseImage component.
 */
export function normalizeImageUrl(url: string | undefined): string {
  if (!url) return '/logo.png';
  
  let path = url.trim();
  
  if (path === '' || path === '/logo.png' || path === 'logo.png') {
    return '/logo.png';
  }

  // If it's a full URL or gs://, return as is
  if (path.startsWith('http') || path.startsWith('gs://') || path.startsWith('data:') || path.startsWith('//')) {
    return path;
  }

  // Ensure leading slash for local paths
  return path.startsWith('/') ? path : `/${path}`;
}
