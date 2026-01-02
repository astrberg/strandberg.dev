import { wait, updateProgress } from './utils.js';

export async function runMockUpload(file) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  updateProgress(progressBar, progressText, 25, 'Getting upload URL...');
  await wait(400);
  updateProgress(progressBar, progressText, 50, 'Uploading file...');
  await wait(800);
  updateProgress(progressBar, progressText, 100, 'Upload complete!');

  const resultText = document.getElementById('resultText');
  if (resultText) {
    resultText.innerHTML = `<span class="success">✓ Mock upload complete for ${file.name}</span>`;
  }
  
  const downloadLink = document.getElementById('downloadLink');
  if (downloadLink) {
    downloadLink.href = '#';
    downloadLink.textContent = 'Mock link';
    downloadLink.classList.add('hidden');
  }
}

export function getMockMetadata(file) {
  return {
    filename: file.name,
    detected_at: new Date().toISOString(),
    detection_result: {
      best_date: '2004-01-01T00:00:00',
      confidence: 'medium',
      dates_found: {
        ai: {
          confidence: 'medium',
          date: '2004-01-01T00:00:00',
          reasoning: "The primary clue is a banner with the 'e.on' logo visible in the background. The low-res format and filename indicate early 2000s source."
        }
      },
      file: `/tmp/${file.name}`
    }
  };
}

export function simulateMockPoll(pollAttempts, file) {
  if (pollAttempts < 2) {
    return { status: 202 };
  }
  return { status: 200, json: async () => getMockMetadata(file) };
}
