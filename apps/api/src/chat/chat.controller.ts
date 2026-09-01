import { Body, Controller, Post } from "@nestjs/common";
import { IsString, MaxLength, MinLength } from "class-validator";
import { ChatService } from "./chat.service";

class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;
}

@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  ask(@Body() body: ChatDto) {
    return this.chat.ask(body.message);
  }
}
