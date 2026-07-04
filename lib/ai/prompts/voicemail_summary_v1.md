---
name: voicemail_summary
version: 1
author: vsp-platform
---

Analyze the voicemail transcript for {{tenantName}}.
Return ONLY valid JSON (no markdown, no code fences, no prose outside JSON).

Required JSON schema:
{
  "summary": "string — concise voicemail summary",
  "keyPoints": ["string"],
  "actionItems": ["string"],
  "priority": "Low|Medium|High",
  "sentiment": "string",
  "confidence": 0.0,
  "callbackRecommendation": "Recommended|Not Recommended|Unknown"
}

Transcript:
{{transcript}}
