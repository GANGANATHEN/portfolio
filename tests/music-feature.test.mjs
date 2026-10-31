import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".flac",
  ".weba",
];

function validateAudioFile(fileName, mimeType) {
  const isAudioType = mimeType ? mimeType.startsWith("audio/") : false;
  const fileNameLower = fileName.toLowerCase();
  const hasSupportedExtension = SUPPORTED_AUDIO_EXTENSIONS.some((ext) =>
    fileNameLower.endsWith(ext)
  );

  if (!isAudioType && !hasSupportedExtension) {
    return {
      valid: false,
      error: "Unsupported audio file format. Please choose an MP3, WAV, OGG, or AAC file.",
    };
  }

  return { valid: true };
}

test("Music Feature: Default Music, Custom Music, and Audio Management Suite", async (t) => {
  // 1. Default Music Asset Verification
  await t.test("1. Default ambient track exists in public/audio and is a valid PCM WAV audio file", async () => {
    const audioPath = path.join(process.cwd(), "public/audio/default-ambient.wav");
    assert.ok(fs.existsSync(audioPath), "default-ambient.wav must exist in public/audio");

    const stat = fs.statSync(audioPath);
    assert.ok(stat.size > 100000, `Audio file should be non-trivial size: ${stat.size} bytes`);

    // Verify RIFF WAVE header
    const buffer = Buffer.alloc(44);
    const fd = fs.openSync(audioPath, "r");
    fs.readSync(fd, buffer, 0, 44, 0);
    fs.closeSync(fd);

    const riff = buffer.toString("utf8", 0, 4);
    const wave = buffer.toString("utf8", 8, 12);
    const fmt = buffer.toString("utf8", 12, 16);
    const audioFormat = buffer.readUInt16LE(20); // 1 = PCM
    const channels = buffer.readUInt16LE(22);    // 2 = Stereo
    const sampleRate = buffer.readUInt32LE(24);  // 32000 Hz

    assert.equal(riff, "RIFF", "File header must start with RIFF");
    assert.equal(wave, "WAVE", "File format must be WAVE");
    assert.equal(fmt, "fmt ", "Format chunk must be fmt ");
    assert.equal(audioFormat, 1, "Audio format must be PCM (1)");
    assert.equal(channels, 2, "Audio must be stereo (2 channels)");
    assert.equal(sampleRate, 32000, "Sample rate must be 32kHz");
  });

  // 2. Custom Music Validation
  await t.test("2. Custom audio validation accepts supported audio formats and rejects non-audio files", async () => {
    // Valid formats
    assert.equal(validateAudioFile("favorite-track.mp3", "audio/mpeg").valid, true);
    assert.equal(validateAudioFile("recording.wav", "audio/wav").valid, true);
    assert.equal(validateAudioFile("soundtrack.ogg", "audio/ogg").valid, true);
    assert.equal(validateAudioFile("chill.m4a", "audio/mp4").valid, true);
    assert.equal(validateAudioFile("ambient.aac", "audio/aac").valid, true);
    assert.equal(validateAudioFile("lossless.flac", "audio/flac").valid, true);
    assert.equal(validateAudioFile("untyped-track.mp3", "").valid, true);

    // Invalid formats
    const badExe = validateAudioFile("malware.exe", "application/octet-stream");
    assert.equal(badExe.valid, false);
    assert.ok(badExe.error?.includes("Unsupported audio file format"));

    const badPdf = validateAudioFile("resume.pdf", "application/pdf");
    assert.equal(badPdf.valid, false);

    const badImg = validateAudioFile("photo.jpg", "image/jpeg");
    assert.equal(badImg.valid, false);

    const badTxt = validateAudioFile("notes.txt", "text/plain");
    assert.equal(badTxt.valid, false);
  });

  // 3. Audio Object URL Lifecycle and Memory Leak Prevention
  await t.test("3. Object URL lifecycle simulation revokes old URLs upon replacement or reset", async () => {
    const revokedUrls = [];
    const mockRevoke = (url) => {
      revokedUrls.push(url);
    };

    let currentUrl = null;

    // Simulate selecting first file
    const file1Url = "blob:http://localhost:3000/mock-uuid-1";
    currentUrl = file1Url;

    // Simulate replacing with second file
    const file2Url = "blob:http://localhost:3000/mock-uuid-2";
    if (currentUrl) {
      mockRevoke(currentUrl);
    }
    currentUrl = file2Url;

    assert.equal(revokedUrls.length, 1);
    assert.equal(revokedUrls[0], file1Url);

    // Simulate component cleanup
    if (currentUrl) {
      mockRevoke(currentUrl);
      currentUrl = null;
    }

    assert.equal(revokedUrls.length, 2);
    assert.equal(revokedUrls[1], file2Url);
    assert.equal(currentUrl, null);
  });

  // 4. Single Audio Source State Transition & Volume Rules
  await t.test("4. Volume bounds, mute calculation, and single audio instance state logic", async () => {
    let volume = 0.3;
    let isMuted = false;

    // Effective volume
    const getEffectiveVolume = (v, muted) => (muted ? 0 : Math.max(0, Math.min(1, v)));

    assert.equal(getEffectiveVolume(volume, isMuted), 0.3);

    // Muted
    isMuted = true;
    assert.equal(getEffectiveVolume(volume, isMuted), 0);

    // Unmute
    isMuted = false;
    assert.equal(getEffectiveVolume(volume, isMuted), 0.3);

    // Change volume
    volume = 0.75;
    assert.equal(getEffectiveVolume(volume, isMuted), 0.75);

    // Clamp out-of-bounds
    assert.equal(getEffectiveVolume(1.5, false), 1.0);
    assert.equal(getEffectiveVolume(-0.2, false), 0.0);
  });

  // 5. Track Switching Without Overlap
  await t.test("5. Switching modes safely resets source and never creates overlapping instances", async () => {
    let currentSource = "/audio/default-ambient.wav";
    let isPlaying = true;
    let callLog = [];

    const mockAudio = {
      pause: () => callLog.push("pause"),
      load: () => callLog.push("load"),
      play: async () => {
        callLog.push("play");
        return Promise.resolve();
      },
      set src(val) {
        callLog.push(`src=${val}`);
        currentSource = val;
      },
      get src() {
        return currentSource;
      },
    };

    // User switches to custom track
    const switchSource = async (newSrc, shouldPlay) => {
      mockAudio.pause();
      mockAudio.src = newSrc;
      mockAudio.load();
      if (shouldPlay) {
        await mockAudio.play();
      }
    };

    await switchSource("blob:http://localhost:3000/user-song.mp3", isPlaying);

    assert.deepEqual(callLog, [
      "pause",
      "src=blob:http://localhost:3000/user-song.mp3",
      "load",
      "play",
    ]);

    // Switch back to default
    callLog = [];
    await switchSource("/audio/default-ambient.wav", true);

    assert.deepEqual(callLog, [
      "pause",
      "src=/audio/default-ambient.wav",
      "load",
      "play",
    ]);
  });
});

