import { SIGNED_URL_ENDPOINT } from './config.js';
import { getIdToken } from './auth.js';
import { updateProgress, formatHttpError } from './utils.js';

export async function getSignedUrl(file) {
  const token = getIdToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  const urlWithQuery = `${SIGNED_URL_ENDPOINT}?filename=${encodeURIComponent(file.name)}`;

  const signedUrlResponse = await fetch(urlWithQuery, {
    method: 'POST',
    headers: {
      'X-Upload-Content-Type': file.type,
      'X-Upload-Content-Length': file.size,
      Authorization: `Bearer ${token}`
    }
  });

  if (!signedUrlResponse.ok) {
    const errorMsg = await formatHttpError(signedUrlResponse);
    throw new Error(errorMsg);
  }

  const { url } = await signedUrlResponse.json();
  if (!url) {
    throw new Error('No URL returned from server');
  }
  return url;
}

export async function uploadToSignedUrl(url, file, {progressBarEl, progressTextEl}) {
  updateProgress(progressBarEl, progressTextEl, 50, 'Uploading file...');
  const uploadResponse = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
      'x-goog-content-length-range': `0,${file.size}`
    },
    body: file
  });

  if (!uploadResponse.ok) {
    const errorMsg = await formatHttpError(uploadResponse);
    throw new Error(errorMsg);
  }

  return uploadResponse;
}
