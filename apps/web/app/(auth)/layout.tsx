import { Logo } from "../../components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-panel border border-line bg-board p-6 shadow-pop">
        <Logo />
        {children}
      </div>
    </main>
  );
}
