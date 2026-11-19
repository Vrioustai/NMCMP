export type OutboundMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function passwordResetMail(from: string, to: string, link: string): OutboundMail {
  const text = [
    "Có người yêu cầu đặt lại mật khẩu FilmGenZ.",
    "",
    "Mở liên kết này trong vòng 30 phút:",
    link,
    "",
    "Nếu bạn không yêu cầu, hãy bỏ qua email này.",
  ].join("\n");
  const safeLink = escapeHtml(link);
  const html = [
    "<p>Có người yêu cầu đặt lại mật khẩu FilmGenZ.</p>",
    `<p><a href="${safeLink}">Đặt lại mật khẩu</a></p>`,
    "<p>Liên kết hết hạn sau 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>",
  ].join("");
  return {
    from,
    to,
    subject: "Đặt lại mật khẩu FilmGenZ",
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
