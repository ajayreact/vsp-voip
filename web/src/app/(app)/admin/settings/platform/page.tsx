'use client';

import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminSettingsTabs } from '@/components/admin-section-nav';
import { AdminPlatformSettingsForm } from '@/components/admin-platform-settings-form';

export default function AdminSettingsPlatformPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader
        section="Settings"
        title="Platform settings"
        subtitle="Default markup fees and platform-wide configuration."
      />
      <AdminSectionNav tabs={adminSettingsTabs} />
      <AdminPlatformSettingsForm sections={['markup']} saveLabel="Save platform settings" />
    </div>
  );
}
