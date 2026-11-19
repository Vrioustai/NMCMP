import { ForgotForm } from "../../../components/auth/forgot-form";

export const metadata = { title: "Quên mật khẩu" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-extrabold">Quên mật khẩu</h1>
      <ForgotForm />
    </>
  );
}
