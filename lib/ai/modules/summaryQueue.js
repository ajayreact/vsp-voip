const { logger } = require('../../logger');

/**
 * In-process async queue — replace with Bull/SQS worker without changing module APIs.
 */
const pendingJobs = [];
let draining = false;

function scheduleSummaryJob(jobName, jobFn) {
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
      logger.error('ai_summary_job_failed', {
        job: job.jobName,
        message: error.message,
        code: error.code,
      });
    }
  }
  draining = false;
}

function resetSummaryQueueForTests() {
  pendingJobs.length = 0;
  draining = false;
}

function getPendingJobCount() {
  return pendingJobs.length;
}

module.exports = {
  scheduleSummaryJob,
  resetSummaryQueueForTests,
  getPendingJobCount,
};
