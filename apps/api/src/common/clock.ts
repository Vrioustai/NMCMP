const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";

// Một thao tác giữ một mốc. Năm lấy theo lịch của múi giờ ứng dụng, không lấy năm UTC.
export class Clock {
  constructor(
    private readonly instant: Date,
    private readonly timeZone = DEFAULT_TIME_ZONE,
  ) {}

  static start(timeZone = DEFAULT_TIME_ZONE): Clock {
    return new Clock(new Date(), timeZone);
  }

  now(): Date {
    return this.instant;
  }

  year(): number {
    const year = new Intl.DateTimeFormat("en-US", {
      timeZone: this.timeZone,
      year: "numeric",
    })
      .formatToParts(this.instant)
      .find((part) => part.type === "year")?.value;
    if (!year) throw new Error("Không đọc được năm theo múi giờ ứng dụng.");
    return Number(year);
  }
}
