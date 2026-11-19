import { redirect } from "next/navigation";
import { ProfileForm } from "../../../components/account/profile-form";
import { errorMessage } from "../../../lib/error-messages";
import { getSession, isAccountLocked } from "../../../lib/get-session";

export const metadata = { title: "Tài khoản" };

export default async function MePage() {
  const user = await getSession();
  if (!user) {
    if (await isAccountLocked()) {
      return <p role="status">{errorMessage("ACCOUNT_LOCKED")}</p>;
    }
    redirect("/login?next=%2Fme");
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold">Tài khoản</h1>
      <ProfileForm user={user} />
    </>
  );
}
