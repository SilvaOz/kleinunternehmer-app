import Sidebar from "@/components/layout/Sidebar";

export const metadata = {
  title: "Dashboard - InvoiceOS",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main style={{ marginLeft: 220, padding: "28px 28px" }}>{children}</main>
    </>
  );
}
