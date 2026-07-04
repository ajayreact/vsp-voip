const { logger } = require('../../logger');

const pendingJobs = [];
let draining = false;

function scheduleTranscriptionJob(jobName, jobFn) {
  pendingJobs.push({ jobName, jobFn });
  if (!draining) {
    draining = true;
    setImmediate(drainQueue);
  }
}

async function drainQueue() {
  while (pendingJobs.length > 0) {
    const job = pendingJobs.shift();
    try {
      await job.jobFn();
    } catch (error) {
      logger.error('ai_transcription_job_failed', {
        job: job.jobName,
        message: error.message,
        code: error.code,
      });
    }
  }
  draining = false;
}

function resetTranscriptionQueueForTests() {
  pendingJobs.length = 0;
  draining = false;
}

function getPendingTranscriptionJobCount() {
  return pendingJobs.length;
}

module.exports = {
  scheduleTranscriptionJob,
  resetTranscriptionQueueForTests,
  getPendingTranscriptionJobCount,
};
