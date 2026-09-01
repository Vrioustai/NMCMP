"use client";

import { FormEvent, useState } from "react";

export function ChatWidget() {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("Xin chào! Bạn muốn xem thể loại phim nào?");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = await response.json();
      setAnswer(data.message ?? "Không nhận được phản hồi.");
      setMessage("");
    } finally { setLoading(false); }
  }

  return <aside className="chat-widget"><p>{answer}</p><form onSubmit={submit}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hỏi chatbot..." /><button disabled={loading}>{loading ? "..." : "Gửi"}</button></form></aside>;
}
