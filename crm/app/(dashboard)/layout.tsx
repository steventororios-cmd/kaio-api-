import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="min-h-screen flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
