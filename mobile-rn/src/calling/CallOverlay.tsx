import React from 'react';
import { Modal } from 'react-native';
import { useCallingStore } from '../store/callingStore';
import { ActiveCallScreen } from '../screens/calls/ActiveCallScreen';
import { IncomingCallScreen } from '../screens/calls/IncomingCallScreen';

export function CallOverlay() {
  const incomingCall = useCallingStore((s) => s.incomingCall);
  const activeCall = useCallingStore((s) => s.activeCall);
  const showIncoming = Boolean(incomingCall);
  const showActive = Boolean(activeCall && !incomingCall);

  return (
    <Modal visible={showIncoming || showActive} animationType="slide" presentationStyle="fullScreen">
      {showIncoming && incomingCall ? (
        <IncomingCallScreen session={incomingCall} />
      ) : showActive && activeCall ? (
        <ActiveCallScreen session={activeCall} />
      ) : null}
    </Modal>
  );
}
