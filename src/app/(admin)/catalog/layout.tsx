import CatalogTabs from "./_CatalogTabs";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 leading-tight">Catalog</h2>
        <p className="text-sm text-gray-500 mt-0.5 font-medium">Manage products, thalis, and categories</p>
      </div>
      <CatalogTabs />
      <div className="mt-4">{children}</div>
    </div>
  );
}
