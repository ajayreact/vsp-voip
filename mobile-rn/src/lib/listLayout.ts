import { useCallback } from 'react';
import { LIST_ITEM_HEIGHT } from './listConstants';

type ItemLayout = { span?: number; size?: number };

export function fixedRowOverride(height: number) {
  return (layout: ItemLayout) => {
    layout.size = height;
  };
}

export const callRowLayout = fixedRowOverride(LIST_ITEM_HEIGHT.call);
export const contactRowLayout = fixedRowOverride(LIST_ITEM_HEIGHT.contact);
export const conversationRowLayout = fixedRowOverride(LIST_ITEM_HEIGHT.conversation);
export const voicemailRowLayout = fixedRowOverride(LIST_ITEM_HEIGHT.voicemail);

export function useFixedRowLayout(height: number) {
  return useCallback((layout: ItemLayout) => {
    layout.size = height;
  }, [height]);
}
