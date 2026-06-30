/**
 * Thin adapter over lib/telnyxCallControl.js (V2 scaffold).
 * Production bridge logic remains in telnyxCallControl until Phase 3 wiring.
 */
const {
  answerCall,
  dialDestination,
  speakCall,
} = require('../telnyxCallControl');

module.exports = {
  answerParkedLeg: answerCall,
  dialAndBridge: dialDestination,
  speakAndHangup: speakCall,
};
