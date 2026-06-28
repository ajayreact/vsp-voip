type PortalPageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export function PortalPageHeader({ title, description, actions }: PortalPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle mt-1">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
