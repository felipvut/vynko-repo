/**
 * Compress an image file to JPEG with max dimensions and quality control.
 * Returns a Blob ready for upload.
 */
export const compressImage = (file: File, maxSize = 1200, maxKB = 800): Promise<Blob> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const { naturalWidth: w, naturalHeight: h } = img;

      // Scale down maintaining aspect ratio
      let outW = w;
      let outH = h;
      if (outW > maxSize || outH > maxSize) {
        const ratio = Math.min(maxSize / outW, maxSize / outH);
        outW = Math.round(outW * ratio);
        outH = Math.round(outH * ratio);
      }

      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, outW, outH);

      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size > maxKB * 1024 && quality > 0.3) {
              quality -= 0.1;
              tryCompress();
            } else {
              resolve(blob);
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryCompress();
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
};

/**
 * Compress a video by re-encoding at reduced resolution via Canvas + MediaRecorder.
 * Reduces width/height by the given scale factor (default 0.5 = 50%).
 * Returns a webm Blob. Falls back to original file on failure.
 */
export const compressVideo = (
  file: File,
  scale = 0.5,
  onProgress?: (stage: string) => void
): Promise<Blob> => {
  return new Promise((resolve) => {
    // If MediaRecorder not supported, return original
    if (typeof MediaRecorder === "undefined") {
      console.warn("[compressVideo] MediaRecorder not supported, using original");
      resolve(file);
      return;
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // Required for canvas capture on some browsers
    video.crossOrigin = "anonymous";
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);
    let resolved = false;
    const safeResolve = (blob: Blob) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(blob);
    };

    // Timeout: if nothing happens in 60s, give up
    const timeout = setTimeout(() => {
      console.warn("[compressVideo] Timeout, using original");
      safeResolve(file);
    }, 60000);

    video.onerror = () => {
      console.warn("[compressVideo] Video load error, using original");
      clearTimeout(timeout);
      safeResolve(file);
    };

    video.onloadedmetadata = () => {
      // Wait for enough data to play
      video.oncanplay = () => {
        video.oncanplay = null; // only once
        startCompression();
      };
    };

    function startCompression() {
      const outW = Math.max(2, Math.round(video.videoWidth * scale));
      const outH = Math.max(2, Math.round(video.videoHeight * scale));

      console.log(`[compressVideo] ${video.videoWidth}x${video.videoHeight} → ${outW}x${outH}, duration: ${video.duration}s`);
      onProgress?.(`Comprimindo vídeo (${video.videoWidth}x${video.videoHeight} → ${outW}x${outH})...`);

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;

      // Fill black first frame
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, outW, outH);

      // Determine best supported codec
      const mimeOptions = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      let mimeType = "";
      for (const m of mimeOptions) {
        if (MediaRecorder.isTypeSupported(m)) {
          mimeType = m;
          break;
        }
      }

      if (!mimeType) {
        console.warn("[compressVideo] No supported mime type, using original");
        clearTimeout(timeout);
        safeResolve(file);
        return;
      }

      // Use aggressive bitrate: roughly 600kbps for half-res
      const stream = canvas.captureStream(24);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 600_000,
        });
      } catch (err) {
        console.warn("[compressVideo] MediaRecorder init failed:", err);
        clearTimeout(timeout);
        safeResolve(file);
        return;
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        clearTimeout(timeout);
        const compressed = new Blob(chunks, { type: "video/webm" });
        const savedPct = ((1 - compressed.size / file.size) * 100).toFixed(1);
        console.log(`[compressVideo] Original: ${(file.size / 1024 / 1024).toFixed(2)}MB, Compressed: ${(compressed.size / 1024 / 1024).toFixed(2)}MB (${savedPct}% reduction)`);

        if (compressed.size > 0 && compressed.size < file.size) {
          onProgress?.(`Vídeo comprimido (${savedPct}% menor)`);
          safeResolve(compressed);
        } else {
          console.warn("[compressVideo] Compressed not smaller, using original");
          safeResolve(file);
        }
      };

      recorder.onerror = (e) => {
        console.warn("[compressVideo] Recorder error:", e);
        clearTimeout(timeout);
        safeResolve(file);
      };

      // Start recording, request data every second
      recorder.start(1000);

      let animId: number;

      const drawFrame = () => {
        if (video.ended || video.paused) {
          // Ensure we stop
          if (recorder.state === "recording") {
            recorder.stop();
          }
          return;
        }
        ctx.drawImage(video, 0, 0, outW, outH);
        animId = requestAnimationFrame(drawFrame);
      };

      video.onended = () => {
        cancelAnimationFrame(animId);
        // Draw final frame
        ctx.drawImage(video, 0, 0, outW, outH);
        // Small delay to ensure last frames are captured
        setTimeout(() => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, 200);
      };

      video.onpause = () => {
        // If paused unexpectedly (not by us), resume
        if (!video.ended && recorder.state === "recording") {
          video.play().catch(() => {
            cancelAnimationFrame(animId);
            if (recorder.state === "recording") recorder.stop();
          });
        }
      };

      // Play at max speed if possible
      video.playbackRate = 1.0;
      video.play().then(() => {
        console.log("[compressVideo] Playback started");
        drawFrame();
      }).catch((err) => {
        console.warn("[compressVideo] Play failed:", err);
        cancelAnimationFrame(animId);
        clearTimeout(timeout);
        if (recorder.state === "recording") {
          recorder.stop(); // will resolve with whatever was captured
        } else {
          safeResolve(file);
        }
      });
    }
  });
};

/**
 * Validate a video file size and type.
 */
export const validateVideo = (file: File, maxMB = 50): { valid: boolean; message?: string } => {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) {
    return { valid: false, message: `Vídeo muito grande (${sizeMB.toFixed(1)}MB). Máximo: ${maxMB}MB` };
  }
  
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov)$/i)) {
    return { valid: false, message: 'Formato não suportado. Use MP4, WebM ou MOV.' };
  }

  return { valid: true };
};

/**
 * Generate a thumbnail from a video file.
 * Returns a Blob of the thumbnail image.
 */
export const generateVideoThumbnail = (file: File, seekTime = 1): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTime, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 400;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        },
        "image/jpeg",
        0.7
      );
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
};
