import { ResetForm } from "../../../components/auth/reset-form";

export const metadata = { title: "Đặt mật khẩu mới" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mt-6 text-2xl font-extrabold">Đặt mật khẩu mới</h1>
      <ResetForm />
    </>
  );
}
