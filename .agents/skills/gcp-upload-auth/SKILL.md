---
name: gcp-upload-auth
description: Guidelines for managing Google OAuth client-side credentials, validating cookies, decoding JWT token parameters, requesting signed URLs from API gateways, and implementing chunked direct storage uploads.
---

# Skill: Google Auth & Cloud Storage Uploads

This skill governs client-side authentication and file uploading operations used in `/organize-media/` and implemented inside `assets/js/organize-media/`.

## Architecture Overview

*   **Google One Tap & Client Sign-In (`auth.js`)**: Implements Google Identity Services (GSI) login controls. Reads the client ID from config, mounts the GSI button, parses credentials returned from Google, and saves the ID Token in secure cookies.
*   **JWT Handling (`auth.js`)**: Decodes the base64-encoded payload of Google ID tokens to read custom attributes (e.g., name, avatar) and compute token expiration times (`exp` claim) to prompt re-login when expired.
*   **Signed URL Generation (`upload.js`)**: Sends authentication headers and filename metadata to the Google Cloud Run API Gateway to request a secure Google Cloud Storage signed upload URL.
*   **Chunked Cloud Uploads (`upload.js`)**: Executes direct HTTP PUT requests to the GCS signed URL with progress listeners to update UI progress bars and handle large video files.
*   **Mock Fallback Simulation (`mock.js`)**: Provides simulated authentication and file transfer behaviors for offline/development environments where live API keys or cloud gateways are unreachable.

## Key Development Rules

1.  **Secure Storage**: Never store plaintext passwords or sensitive credentials locally. Store JWTs in secure cookies or SessionStorage, enforcing clean expiration checks.
2.  **API Gateway Requests**: Always include the `Authorization` header formatted as `Bearer <ID_TOKEN>` when requesting signed URLs from backend endpoints.
3.  **Mock Environment Routing**: Always preserve the `MOCK_UPLOAD` flag fallback. If `MOCK_UPLOAD` is set to `true`, the code must simulate API calls and upload progress locally instead of hitting live endpoints.
4.  **Error Resilience**:
    *   Handle CORS issues and network dropouts gracefully during direct PUT requests to cloud storage buckets.
    *   Validate files client-side (size, mime-types) before initiating signed URL requests to save API execution time.
5.  **Token Refreshing**: Check JWT expiration times *before* initiating file uploads. If a token is expired or within 60 seconds of expiring, force the user to re-sign in to prevent mid-upload authorization failures.
