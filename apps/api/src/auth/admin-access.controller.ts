import { Controller, Get } from "@nestjs/common";
import { Roles } from "./auth.decorators";

// Route mẫu để kiểm vai trò. Các route quản trị thật sẽ gắn cùng decorator này.
@Controller("admin")
export class AdminAccessController {
  @Get("access")
  @Roles("ADMIN")
  access(): { ok: true } {
    return { ok: true };
  }
}
