import { usePhoneConnection } from './usePhoneConnection';

export function useCanPlaceCalls() {
  return usePhoneConnection().canPlaceCalls;
}
