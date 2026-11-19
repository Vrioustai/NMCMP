import { notFound } from "next/navigation";
import { UiGallery } from "../../../components/dev/ui-gallery";

export const metadata = { title: "Bộ component", robots: { index: false, follow: false } };

export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
