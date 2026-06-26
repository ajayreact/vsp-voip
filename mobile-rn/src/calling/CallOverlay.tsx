import React from 'react';
import { Modal } from 'react-native';
import { useCallingStore } from '../store/callingStore';
import { ActiveCallScreen } from '../screens/calls/ActiveCallScreen';
import { IncomingCallScreen } from '../screens/calls/IncomingCallScreen';

export function CallOverlay() {
  const incomingCall = useCallingStore((s) => s.incomingCall);
  const activeCall = useCallingStore((s) => s.activeCall);

  return (
    <>
      <Modal visible={Boolean(incomingCall && !activeCall)} animationType="slide" presentationStyle="fullScreen">
        {incomingCall ? <IncomingCallScreen session={incomingCall} /> : null}
      </Modal>
      <Modal visible={Boolean(activeCall)} animationType="slide" presentationStyle="fullScreen">
        {activeCall ? <ActiveCallScreen session={activeCall} /> : null}
      </Modal>
    </>
  );
}
