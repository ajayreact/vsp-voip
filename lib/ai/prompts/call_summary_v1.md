---
name: call_summary
version: 1
author: vsp-platform
---

Analyze the completed business call transcript for {{tenantName}}.
Return ONLY valid JSON (no markdown, no code fences, no prose outside JSON).

Required JSON schema:
{
  "summary": "string — short summary",
  "executiveSummary": "string",
  "keyPoints": ["string"],
  "discussionTopics": ["string"],
  "customerIntent": "string",
  "actionItems": ["string"],
  "followUpTasks": ["string"],
  "sentiment": "string",
  "salesOpportunity": "string",
  "priority": "Low|Medium|High",
  "confidence": 0.0
}

Transcript:
{{transcript}}
