# Softphone sound assets

Place the following MP3 files in this directory for production ringback and incoming ring tones:

- `ringback.mp3` — outbound calling tone (looping)
- `incoming-ring.mp3` — inbound ring tone (looping)

If these files are missing, the softphone falls back to a Web Audio API tone so calls still produce audible feedback.

Recommended: 2–4 second seamless loops, mono, 44.1 kHz, under 200 KB each.
