---
layout: me
title: Upload Media - Aron Strandberg
description: Upload and organize media files. Video uploads generate metadata for later retrieval.
permalink: /organize-media/
---

# Upload Media

Upload video files to generate metadata.

<link rel="stylesheet" href="organize-media.css">

<div id="upload-container">
  <div id="upload-form">
    <div id="mockBanner" class="hidden" role="status">
      <span id="mockBannerMessage"></span>
      <button id="bannerSignout" class="hidden">Sign out</button>
    </div>
    <div id="g_id_signin"></div>
    <div id="signin-status" class="hidden">
      <span id="signed-in-message">Signed in</span>
    </div>
    <input type="file" id="videoInput" accept=".mp4,.avi,.mov,.mpg,.mpeg,.mkv,.wmv,.flv,.webm" />
    <button id="uploadButton" disabled>Upload Video</button>
    <div id="fileInfo"></div>
    <div id="progress">
      <div id="progressBar"></div>
      <p id="progressText">0%</p>
    </div>
    <div id="result">
      <p id="resultText"></p>
      <div id="metadataDisplay" class="hidden"></div>
    </div>
  </div>
</div>

<script src="https://accounts.google.com/gsi/client" async defer></script>
<script type="module" src="/assets/js/organize-media/index.js"></script>
