import {
    startOfDay,
    endOfDay,
    addDays,
    subDays,
    max,
    min,
    setHours,
    setMinutes,
    setSeconds,
    setMilliseconds
} from 'date-fns';

/**
 * Calculates the overlap in seconds between a time interval [start, end]
 * and the daily night window (22:00 - 06:00).
 */
export function calculateNightOverlap(start: Date, end: Date): number {
    if (start >= end) return 0;

    let totalOverlapSeconds = 0;

    // Iterate day by day from start to end
    let currentDay = startOfDay(start);
    const lastDay = startOfDay(end);

    while (currentDay <= lastDay) {
        // Night window segments for current day:
        // 1. 00:00 - 06:00
        // 2. 22:00 - 24:00

        const nightSegments = [
            {
                s: setMilliseconds(setSeconds(setMinutes(setHours(currentDay, 0), 0), 0), 0),
                e: setMilliseconds(setSeconds(setMinutes(setHours(currentDay, 6), 0), 0), 0)
            },
            {
                s: setMilliseconds(setSeconds(setMinutes(setHours(currentDay, 22), 0), 0), 0),
                e: setMilliseconds(setSeconds(setMinutes(setHours(currentDay, 24), 0), 0), 0)
            }
        ];

        for (const seg of nightSegments) {
            const overlapStart = max([start, seg.s]);
            const overlapEnd = min([end, seg.e]);

            if (overlapStart < overlapEnd) {
                totalOverlapSeconds += Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 1000);
            }
        }

        currentDay = addDays(currentDay, 1);
    }

    return totalOverlapSeconds;
}
