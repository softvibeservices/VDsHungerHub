// src\app\(admin)\catalog\layout.tsx

import CatalogTabs from "./_CatalogTabs";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CatalogTabs />
      <div>{children}</div>
    </div>
  );
}
