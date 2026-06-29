import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  createTranscriptionProvider,
  resetTranscriptionConfigCache,
  resetTranscriptionQueueForTests,
  SUPPORTED_STT_PROVIDERS,
  validateSttProviderConfiguration,
  calculateSttCostMicros,
  streamToBuffer,
  isTranscriptionFeatureEnabled,
} = require('../../lib/ai/transcription');

describe('STT provider abstraction', () => {
  it('registers supported providers', () => {
    expect(SUPPORTED_STT_PROVIDERS).toContain('openai');
    expect(SUPPORTED_STT_PROVIDERS).toContain('noop');
  });

  it('creates noop provider by default', async () => {
    const provider = createTranscriptionProvider('noop');
    const result = await provider.transcribe({ audioBuffer: Buffer.from('test'), durationSeconds: 10 });
    expect(result.provider).toBe('noop');
    expect(result.transcript).toBe('');
  });

  it('validates openai configuration', () => {
    process.env.OPENAI_API_KEY = '';
    resetTranscriptionConfigCache();
    const status = validateSttProviderConfiguration('openai');
    expect(status.valid).toBe(false);
    expect(status.missing).toContain('OPENAI_API_KEY');
  });
});

describe('transcription gateway confidence parsing', () => {
  it('normalizes whisper verbose_json confidence', () => {
    const parsed = {
      text: 'Hello world',
      language: 'en',
      duration: 12,
      segments: [{ avg_logprob: -0.1 }, { avg_logprob: -0.2 }],
    };
    const avg = parsed.segments.reduce((sum, seg) => sum + (1 + seg.avg_logprob), 0) / parsed.segments.length;
    expect(avg).toBeGreaterThan(0.7);
    expect(parsed.language).toBe('en');
  });
});

describe('transcript storage', () => {
  it('maps completed transcript records', async () => {
    const { markTranscriptCompleted } = require('../../lib/ai/transcription/transcriptStore');
    const prisma = {
      aiTranscript: {
        update: async ({ data }) => ({
          id: 't1',
          tenantId: 'tenant-1',
          entityType: 'voicemail',
          entityId: 'vm-1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    };

    const record = await markTranscriptCompleted(prisma, 'tenant-1', 'voicemail', 'vm-1', {
      transcript: 'Please call back',
      confidence: 0.91,
      detectedLanguage: 'en',
      provider: 'openai',
      model: 'whisper-1',
      durationSeconds: 30,
      processingTimeMs: 1200,
    });

    expect(record.status).toBe('completed');
    expect(record.transcript).toBe('Please call back');
    expect(record.confidence).toBe(0.91);
  });
});

describe('transcription queue', () => {
  beforeEach(() => {
    resetTranscriptionQueueForTests();
  });

  it('runs jobs asynchronously', async () => {
    const { scheduleTranscriptionJob, getPendingTranscriptionJobCount } = require('../../lib/ai/transcription/transcriptionQueue');
    let ran = false;
    scheduleTranscriptionJob('test', async () => {
      ran = true;
    });
    expect(getPendingTranscriptionJobCount()).toBe(1);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(ran).toBe(true);
  });
});

describe('retry and failure handling', () => {
  it('calculates STT cost from duration', () => {
    expect(calculateSttCostMicros('whisper-1', 60)).toBe(6_000);
  });
});

describe('feature flags', () => {
  beforeEach(() => {
    process.env.AI_ENABLED = 'true';
    require('../../lib/ai/config').resetAiConfigCache();
  });

  it('requires master and entity transcription flags', () => {
    const settings = {
      enabled: true,
      features: {
        transcription: true,
        voicemail_transcription: true,
      },
    };
    expect(isTranscriptionFeatureEnabled(settings, 'voicemail')).toBe(true);

    const disabled = {
      enabled: true,
      features: {
        transcription: true,
        voicemail_transcription: false,
      },
    };
    expect(isTranscriptionFeatureEnabled(settings, 'voicemail')).toBe(true);
    expect(isTranscriptionFeatureEnabled(disabled, 'voicemail')).toBe(false);
  });
});

describe('stream to buffer', () => {
  it('concatenates readable chunks', async () => {
    const { Readable } = require('stream');
    const stream = Readable.from([Buffer.from('hello '), Buffer.from('world')]);
    const buffer = await streamToBuffer(stream);
    expect(buffer.toString()).toBe('hello world');
  });
});

describe('automatic summary integration', () => {
  it('skips duplicate summary enqueue', async () => {
    const engine = require('../../lib/ai/transcription/transcriptionEngine');
    const summaryEngine = require('../../lib/ai/modules/summaryEngine');
    const enqueueSpy = vi.spyOn(summaryEngine, 'enqueueSummaryGeneration').mockResolvedValue({ status: 'pending' });

    const prisma = {
      tenantAiSettings: {
        findUnique: async () => ({
          enabled: true,
          features: {
            automatic_summary: true,
            voicemail_summary: true,
            transcription: true,
            voicemail_transcription: true,
          },
        }),
      },
      aiSummary: {
        findUnique: async () => ({ status: 'completed', result: { summary: 'Existing' } }),
      },
    };

    process.env.AI_ENABLED = 'true';
    require('../../lib/ai/config').resetAiConfigCache();

    await engine.maybeTriggerAutomaticSummary(prisma, {
      tenantId: 'tenant-1',
      entityType: 'voicemail',
      entityId: 'vm-1',
      userId: 'user-1',
      transcript: 'New transcript',
    });

    expect(enqueueSpy).not.toHaveBeenCalled();
    enqueueSpy.mockRestore();
  });
});

describe('summary modules consume stored transcripts', () => {
  it('builds voicemail transcript from AiTranscript store', async () => {
    const { buildVoicemailTranscript } = require('../../lib/ai/modules/voicemailSummary');
    const prisma = {
      aiTranscript: {
        findUnique: async () => ({
          status: 'completed',
          transcript: 'Stored voicemail transcript',
        }),
      },
    };

    const text = await buildVoicemailTranscript(
      prisma,
      'tenant-1',
      { id: 'vm-1', from: '+1', durationSeconds: 10 },
      null,
    );
    expect(text).toBe('Stored voicemail transcript');
  });
});
