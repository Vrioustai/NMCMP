import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { ReportsService } from "./reports.service";

const visible = {
  id: 8,
  userId: 4,
  episodeId: 2,
  content: "xin chào",
  timeMs: 1000,
  isHidden: false,
  deletedAt: null,
};

function service(findFirst: jest.Mock, create: jest.Mock) {
  return new ReportsService({
    danmaku: { findFirst },
    report: { create },
  } as unknown as PrismaService);
}

describe("ReportsService", () => {
  it("stores one pending report and refuses a hidden, own, or repeated comment", async () => {
    const findFirst = jest.fn().mockResolvedValue(visible);
    const create = jest.fn().mockResolvedValue({ id: 15 });
    const reports = service(findFirst, create);

    await expect(
      reports.create(9, { danmakuId: 8, reason: "  Spam hoặc quảng cáo  " }),
    ).resolves.toEqual({
      id: 15,
    });
    expect(create).toHaveBeenCalledWith({
      data: { reporterUserId: 9, danmakuId: 8, reason: "Spam hoặc quảng cáo" },
    });

    findFirst.mockResolvedValueOnce(null);
    await expect(reports.create(9, { danmakuId: 8, reason: "ẩn" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    findFirst.mockResolvedValueOnce({ ...visible, userId: 9 });
    await expect(reports.create(9, { danmakuId: 8, reason: "của mình" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(create).toHaveBeenCalledTimes(1);

    create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("trùng", { code: "P2002", clientVersion: "test" }),
    );
    await expect(reports.create(9, { danmakuId: 8, reason: "lần hai" })).rejects.toMatchObject({
      code: "ALREADY_REPORTED",
    });

    create.mockRejectedValueOnce(new Error("mất kết nối"));
    await expect(reports.create(9, { danmakuId: 8, reason: "lỗi khác" })).rejects.toThrow(
      "mất kết nối",
    );
  });

  it("rejects a reason that is empty after cleanup", async () => {
    const create = jest.fn();
    const reports = service(jest.fn(), create);
    await expect(reports.create(9, { danmakuId: 8, reason: " \u0001 " })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    expect(create).not.toHaveBeenCalled();
  });
});
