import { AuthTabs } from "../../../components/auth/auth-tabs";
import { RegisterForm } from "../../../components/auth/register-form";

export const metadata = { title: "Đăng ký" };

export default function RegisterPage() {
  return (
    <>
      <AuthTabs current="register" />
      <h1 className="mt-4 text-2xl font-extrabold">Đăng ký</h1>
      <RegisterForm />
    </>
  );
}
