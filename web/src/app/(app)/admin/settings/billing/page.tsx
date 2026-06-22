'use client';

import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminSettingsTabs } from '@/components/admin-section-nav';
import { AdminPlatformSettingsForm } from '@/components/admin-platform-settings-form';

export default function AdminSettingsBillingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader
        section="Settings"
        title="Billing settings"
        subtitle="Enable payment gateways, then configure Stripe keys and bank transfer details."
      />
      <AdminSectionNav tabs={adminSettingsTabs} />
      <AdminPlatformSettingsForm
        sections={['stripe', 'bank']}
        saveLabel="Save billing settings"
      />
    </div>
  );
}