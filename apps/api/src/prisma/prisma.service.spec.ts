import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaService } from "./prisma.service";

// Không có .env trên CI; DATABASE_URL đã được gán sẵn trong môi trường.
if (existsSync(".env")) loadEnvFile();

describe("PrismaService", () => {
  it("connects when the module starts and disconnects when it stops", async () => {
    const service = new PrismaService();
    const connect = jest.spyOn(service, "$connect").mockResolvedValue();
    const disconnect = jest.spyOn(service, "$disconnect").mockResolvedValue();
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
