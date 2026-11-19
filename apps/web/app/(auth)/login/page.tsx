import { AuthTabs } from "../../../components/auth/auth-tabs";
import { LoginForm } from "../../../components/auth/login-form";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <AuthTabs current="login" />
      <h1 className="mt-4 text-2xl font-extrabold">Đăng nhập</h1>
      <LoginForm next={typeof next === "string" ? next : null} />
    </>
  );
}
