import { loadEnvFile } from "node:process";
import { PrismaService } from "./prisma.service";

try {
  loadEnvFile();
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code !== "ENOENT") throw error;
}

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
