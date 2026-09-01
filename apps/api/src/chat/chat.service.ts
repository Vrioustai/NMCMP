import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class ChatService {
  private readonly client = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  async ask(message: string) {
    if (!this.client) {
      throw new ServiceUnavailableException("OPENAI_API_KEY chưa được cấu hình");
    }

    const response = await this.client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions:
        "Bạn là trợ lý tư vấn phim bằng tiếng Việt. Chỉ đề xuất phim từ dữ liệu do hệ thống cung cấp.",
      input: message,
    });

    return { message: response.output_text };
  }
}
