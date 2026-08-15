import ProfileTabs from "./_ProfileTabs";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <ProfileTabs />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
