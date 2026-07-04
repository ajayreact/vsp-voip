---
name: message_summary
version: 1
author: vsp-platform
---

Analyze the SMS conversation transcript for {{tenantName}}.
The conversation contains {{messageCount}} messages.
Return ONLY valid JSON (no markdown, no code fences, no prose outside JSON).

Required JSON schema:
{
  "summary": "string — short summary",
  "conversationSummary": "string",
  "keyPoints": ["string"],
  "outstandingQuestions": ["string"],
  "actionItems": ["string"],
  "unreadRequests": ["string"],
  "customerIntent": "string",
  "latestDecision": "string",
  "priority": "Low|Medium|High",
  "sentiment": "string",
  "confidence": 0.0
}

Transcript:
{{transcript}}
