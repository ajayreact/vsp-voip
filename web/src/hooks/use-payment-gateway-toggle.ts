'use client';

import { useCallback, useState } from 'react';
import { updateAdminPaymentGateways, type PaymentGatewaySettings } from '@/lib/api';

export type GatewayToggleField = 'bankTransferEnabled' | 'stripeEnabled' | 'razorpayEnabled';

export type GatewayToggleFeedback = {
  type: 'success' | 'error';
  message: string;
} | null;

export function usePaymentGatewayToggle(
  form: PaymentGatewaySettings | null,
  setForm: (settings: PaymentGatewaySettings) => void,
) {
  const [loadingField, setLoadingField] = useState<GatewayToggleField | null>(null);
  const [feedback, setFeedback] = useState<GatewayToggleFeedback>(null);

  const toggleGateway = useCallback(
    async (field: GatewayToggleField, enabled: boolean) => {
      if (!form) return;

      const previous = form;
      setLoadingField(field);
      setFeedback(null);
      setForm({ ...form, [field]: enabled });

      try {
        const res = await updateAdminPaymentGateways({ ...form, [field]: enabled });
        setForm(res.settings);
        setFeedback({
          type: 'success',
          message: 'Payment gateway updated successfully',
        });
      } catch {
        setForm(previous);
        setFeedback({
          type: 'error',
          message: 'Unable to update payment gateway',
        });
      } finally {
        setLoadingField(null);
      }
    },
    [form, setForm],
  );

  return {
    loadingField,
    feedback,
    clearFeedback: () => setFeedback(null),
    toggleGateway,
    isLoading: (field: GatewayToggleField) => loadingField === field,
  };
}
