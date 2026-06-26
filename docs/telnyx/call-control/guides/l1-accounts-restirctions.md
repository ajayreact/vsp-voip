---
title: "L1 Account Restrictions"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/l1-accounts-restirctions.md"
category: "call-control"
synced_at: "2026-06-25T18:43:06.318Z"
content_hash: "5616abc59ba9c3d41383f38c446421dac0a9b40581fce8d567d00a501460b721"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Programmable Voice restrictions for L1 verified accounts

> Restrictions that apply to Programmable Voice on Telnyx L1 verified accounts — automated speak warnings, call limits, and steps to upgrade verification.

The accounts with the L1 verification are restricted in the following way:

* All machine-generated speak commands are pre-pended with "This is an automated call generated on the Telnyx platform, please report any abuse to [fraud@telnyx.com](mailto:fraud@telnyx.com)". This currently includes:

  * /v2/calls
  * /v2/calls/:call\_control\_id/actions/transfer
  * /v2/calls/:call\_control\_id/actions/gather\_using\_audio
  * /v2/calls/:call\_control\_id/actions/gather\_using\_speak
  * /v2/calls/:call\_control\_id/actions/playback\_start
  * /v2/calls/:call\_control\_id/actions/speak
  * /v2/calls/:call\_control\_id/actions/gather\_using\_ai
  * /v2/calls/:call\_control\_id/actions/ai\_assistant\_start
  * and the TeXML verbs:
    * Play
    * Say
    * AIGather
* Limited to a maximum of 100 outbound calls a day.
* Limited to 10 outbound calls per hour.
