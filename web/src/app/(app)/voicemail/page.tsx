'use client';

import { PbxManager } from '@/components/v3/pbx/pbx-manager';
import { v3VoicemailsApi } from '@/lib/v3-api';

function toPayload(form: Record<string, unknown>) {
  return {
    mailboxNumber: form.mailboxNumber,
    extensionId: form.extensionId || null,
    greeting: form.greetingText ? { text: form.greetingText } : null,
    emailDelivery: form.email ? { enabled: true, email: form.email } : null,
    pin: form.pin || null,
    storageLimitMb: Number(form.storageLimitMb) || 100,
    notification: form.notificationEnabled ? { enabled: true } : null,
    isActive: form.isActive !== false,
  };
}

export default function VoicemailPage() {
  return (
    <PbxManager
      title="Voicemail Boxes"
      description="Mailbox configuration for Call Flow Builder — no message storage integration yet."
      nameKey="mailboxNumber"
      fields={[
        { key: 'mailboxNumber', label: 'Mailbox Number' },
        { key: 'extensionId', label: 'Linked Extension ID' },
        { key: 'greetingText', label: 'Greeting Text', type: 'textarea' },
        { key: 'email', label: 'Email Delivery Address' },
        { key: 'pin', label: 'PIN' },
        { key: 'storageLimitMb', label: 'Storage Limit (MB)', type: 'number' },
        { key: 'notificationEnabled', label: 'Notifications', type: 'checkbox' },
        { key: 'isActive', label: 'Active', type: 'checkbox' },
      ]}
      emptyForm={{ mailboxNumber: '', greetingText: 'Please leave a message.', storageLimitMb: 100, isActive: true, notificationEnabled: false }}
      listItems={(s) => v3VoicemailsApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3VoicemailsApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3VoicemailsApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3VoicemailsApi.delete(id)}
      validateItem={(f) => v3VoicemailsApi.validate(toPayload(f))}
      formatRow={(item) => item.isActive ? 'Active' : 'Inactive'}
    />
  );
}
