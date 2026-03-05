// app/admin/hooks/useLog.ts
"use client";

import { useCallback, useState } from "react";
import { nowTime } from "../utils";

export function useLog(maxLines: number = 400) {
  const [log, setLog] = useState<string[]>([]);

  const pushLog = useCallback(
    (line: string) => {
      setLog((prev) => [`${nowTime()} ${line}`, ...prev].slice(0, maxLines));
    },
    [maxLines]
  );

  const clearLog = useCallback(() => setLog([]), []);

  return { log, pushLog, clearLog, setLog };
}