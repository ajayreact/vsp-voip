const crypto = require('crypto');
const { CONFERENCE_STATUS, PARTICIPANT_ROLE } = require('./conferenceConstants');

/** @type {Map<string, { startedAt: number, conferenceId: string }>} */
const activeConferences = new Map();

function resetConferenceStateForTests() {
  activeConferences.clear();
}

/**
 * @returns {string}
 */
function generateConferenceId() {
  return `conf-${crypto.randomUUID()}`;
}

/**
 * @param {string} conferenceName
 */
function conferenceNameFromId(conferenceName) {
  return String(conferenceName || '').slice(0, 128);
}

/**
 * @param {Record<string, unknown>|null|undefined} snapshot
 */
function getConferenceFromSnapshot(snapshot) {
  const conf = snapshot?.conference;
  if (!conf || typeof conf !== 'object') return null;
  return /** @type {Record<string, unknown>} */ (conf);
}

/**
 * @param {Record<string, unknown>|null|undefined} conference
 * @returns {Array<Record<string, unknown>>}
 */
function getParticipants(conference) {
  if (!conference || !Array.isArray(conference.participants)) return [];
  return conference.participants;
}

/**
 * @param {Record<string, unknown>|null|undefined} conference
 */
function getParticipantCount(conference) {
  return getParticipants(conference).filter((p) => !p.leftAt).length;
}

/**
 * @param {Record<string, unknown>|null|undefined} conference
 * @param {string} callControlId
 */
function findParticipant(conference, callControlId) {
  return getParticipants(conference).find(
    (p) => p.callControlId === callControlId && !p.leftAt,
  ) || null;
}

/**
 * @param {Record<string, unknown>|null|undefined} conference
 */
function findHost(conference) {
  return getParticipants(conference).find(
    (p) => p.role === PARTICIPANT_ROLE.HOST && !p.leftAt,
  ) || null;
}

/**
 * @param {Record<string, unknown>} conference
 * @param {Record<string, unknown>} participant
 */
function addParticipantToState(conference, participant) {
  const participants = getParticipants(conference);
  const existing = participants.find((p) => p.callControlId === participant.callControlId && !p.leftAt);
  if (existing) return conference;

  return {
    ...conference,
    participants: [...participants, {
      ...participant,
      joinedAt: participant.joinedAt || new Date().toISOString(),
      muted: Boolean(participant.muted),
    }],
    status: conference.status === CONFERENCE_STATUS.CREATED ? CONFERENCE_STATUS.ACTIVE : conference.status,
  };
}

/**
 * @param {Record<string, unknown>} conference
 * @param {string} callControlId
 * @param {Record<string, unknown>} [patch]
 */
function markParticipantLeft(conference, callControlId, patch = {}) {
  const participants = getParticipants(conference).map((p) => {
    if (p.callControlId !== callControlId || p.leftAt) return p;
    return { ...p, ...patch, leftAt: new Date().toISOString() };
  });
  return { ...conference, participants };
}

/**
 * @param {Record<string, unknown>} conference
 * @param {string} callControlId
 * @param {boolean} muted
 */
function setParticipantMuted(conference, callControlId, muted) {
  const participants = getParticipants(conference).map((p) => {
    if (p.callControlId !== callControlId || p.leftAt) return p;
    return { ...p, muted };
  });
  return { ...conference, participants };
}

/**
 * @param {string} sessionId
 * @param {string} conferenceId
 */
function registerActiveConference(sessionId, conferenceId) {
  activeConferences.set(sessionId, { startedAt: Date.now(), conferenceId });
}

/**
 * @param {string} sessionId
 */
function unregisterActiveConference(sessionId) {
  activeConferences.delete(sessionId);
}

/**
 * @param {string} sessionId
 */
function isConferenceActive(sessionId) {
  return activeConferences.has(sessionId);
}

/**
 * @param {string} sessionId
 * @param {number} timeoutSec
 */
function isConferenceTimedOut(sessionId, timeoutSec) {
  const entry = activeConferences.get(sessionId);
  if (!entry) return false;
  return Date.now() - entry.startedAt >= timeoutSec * 1000;
}

/**
 * @param {Record<string, unknown>} conference
 */
function buildInitialConferenceState(input) {
  return {
    conferenceId: input.conferenceId,
    conferenceName: input.conferenceName,
    status: CONFERENCE_STATUS.CREATED,
    hostCallControlId: input.hostCallControlId,
    hostLegId: input.hostLegId ?? null,
    participants: [],
    recordingActive: false,
    createdAt: new Date().toISOString(),
    startedAt: null,
    maxParticipants: input.maxParticipants ?? 10,
  };
}

module.exports = {
  resetConferenceStateForTests,
  generateConferenceId,
  conferenceNameFromId,
  getConferenceFromSnapshot,
  getParticipants,
  getParticipantCount,
  findParticipant,
  findHost,
  addParticipantToState,
  markParticipantLeft,
  setParticipantMuted,
  registerActiveConference,
  unregisterActiveConference,
  isConferenceActive,
  isConferenceTimedOut,
  buildInitialConferenceState,
};
