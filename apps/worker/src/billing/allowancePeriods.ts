export type AllowancePeriod = {
  expiresAtMs: number;
  periodKey: string;
  startsAtMs: number;
};

export function freeAllowancePeriod(nowMs: number): AllowancePeriod {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    expiresAtMs: Date.UTC(year, month + 1, 1),
    periodKey: `free:${year}-${String(month + 1).padStart(2, "0")}`,
    startsAtMs: Date.UTC(year, month, 1),
  };
}

export function proAllowancePeriod(params: {
  anchorAtMs: number;
  cycleIndex: number;
  episodeId: string;
}): AllowancePeriod {
  if (!Number.isInteger(params.cycleIndex) || params.cycleIndex < 0) {
    throw new RangeError("cycleIndex must be a non-negative integer");
  }
  return {
    expiresAtMs: addClampedUtcMonths(params.anchorAtMs, params.cycleIndex + 1),
    periodKey: `pro:${params.episodeId}:${params.cycleIndex}`,
    startsAtMs: addClampedUtcMonths(params.anchorAtMs, params.cycleIndex),
  };
}

export function currentProAllowancePeriod(params: {
  anchorAtMs: number;
  episodeId: string;
  nowMs: number;
}): AllowancePeriod {
  const anchor = new Date(params.anchorAtMs);
  const now = new Date(params.nowMs);
  let cycleIndex = Math.max(
    0,
    (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
      now.getUTCMonth() - anchor.getUTCMonth(),
  );
  let period = proAllowancePeriod({
    anchorAtMs: params.anchorAtMs,
    cycleIndex,
    episodeId: params.episodeId,
  });
  if (params.nowMs < period.startsAtMs && cycleIndex > 0) {
    cycleIndex -= 1;
    period = proAllowancePeriod({
      anchorAtMs: params.anchorAtMs,
      cycleIndex,
      episodeId: params.episodeId,
    });
  } else if (params.nowMs >= period.expiresAtMs) {
    cycleIndex += 1;
    period = proAllowancePeriod({
      anchorAtMs: params.anchorAtMs,
      cycleIndex,
      episodeId: params.episodeId,
    });
  }
  return period;
}

function addClampedUtcMonths(anchorAtMs: number, monthOffset: number): number {
  const anchor = new Date(anchorAtMs);
  const targetMonthStart = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + monthOffset, 1),
  );
  const targetYear = targetMonthStart.getUTCFullYear();
  const targetMonth = targetMonthStart.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return Date.UTC(
    targetYear,
    targetMonth,
    Math.min(anchor.getUTCDate(), lastDay),
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  );
}
