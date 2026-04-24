import type { Request, Response } from 'express';
import * as db from '../db.js';
import { calculateNightOverlap } from '../utils/timeUtils.js';

/** Обрезает первую и последнюю цифру (символ) из штрих-кода сотрудника. */
function trimFirstAndLastDigit(value: string): string {
    const s = value.trim();
    if (s.length <= 2) return '';
    return s.slice(1, -1);
}

export const handleScan = async (req: Request, res: Response) => {
    const { zoneId, scannedValue, currentEmployeeBarcode, currentActivityId, ts } = req.body;
    const now = ts ? new Date(ts) : new Date();

    if (!scannedValue || typeof scannedValue !== 'string' || scannedValue.trim() === '') {
        return res.json({ type: 'ERROR', message: 'Пустой или недопустимый штрих-код' });
    }

    // 1. Resolve Command
    const command = await db.getCommand(scannedValue);
    if (command) {
        return handleCommand(command.code, currentEmployeeBarcode, now, res);
    }

    // 2. Resolve Activity
    const activity = await db.getActivity(scannedValue);
    if (activity) {
        if (!zoneId) {
            return res.json({ type: 'ERROR', message: 'Выберите зону перед сканированием активности' });
        }
        if (activity.zoneId !== zoneId) {
            return res.json({ type: 'ERROR', message: `Активность ${activity.shortName} не принадлежит зоне ${zoneId}` });
        }
        return res.json({ type: 'ACTIVITY_SELECTED', payload: activity });
    }

    // 3. Resolve Employee (для штрих-кода сотрудника обрезаем первую и последнюю цифру)
    const employeeBarcode = trimFirstAndLastDigit(scannedValue) || scannedValue.trim();
    const employee = await db.queryEmployee(employeeBarcode);
    if (employee) {
        return handleEmployeeScan(employee, currentActivityId, now, res);
    }

    return res.json({ type: 'ERROR', message: 'ШК не распознан. Проверьте ШК или обратитесь к администратору.' });
};

async function handleEmployeeScan(employee: any, currentActivityId: number | null, now: Date, res: Response) {
    const activeSession = await db.getActiveSession(employee.barcode);
    const lastToday = await db.getLastTodaySession(employee.barcode);

    // If active session exists (WORK or BREAK), show status
    if (activeSession) {
        return res.json({
            type: 'EMPLOYEE_SHOWN',
            payload: { employee, activeSession },
            message: `Текущий статус: ${activeSession.status === 'WORK' ? 'РАБОТА' : 'ПЕРЕРЫВ'}`
        });
    }

    // If last session today is OUT and activity is selected, allow new check-in
    if (lastToday && lastToday.status === 'OUT' && currentActivityId) {
        await db.createSession({
            employeeBarcode: employee.barcode,
            activityId: currentActivityId,
            date: now,
            inTime: now,
            timeType: 'X1',
            employeeFullName: employee.fullName ?? null,
            employeeBossId: employee.bossId ?? null,
            employeeManningId: employee.manningId ?? null
        });
        const newSession = await db.getActiveSession(employee.barcode);
        return res.json({
            type: 'CHECKIN_DONE',
            payload: { employee, session: newSession },
            message: 'ПРИХОД зафиксирован: статус РАБОТА'
        });
    }

    // If last session today is OUT and no activity selected, show status
    if (lastToday && lastToday.status === 'OUT') {
        return res.json({
            type: 'EMPLOYEE_SHOWN',
            payload: { employee, activeSession: lastToday },
            message: 'Смена завершена (УХОД). Отсканируйте активность для нового прихода'
        });
    }

    // No sessions today: check-in if activity is selected
    if (currentActivityId) {
        await db.createSession({
            employeeBarcode: employee.barcode,
            activityId: currentActivityId,
            date: now,
            inTime: now,
            timeType: 'X1',
            employeeFullName: employee.fullName ?? null,
            employeeBossId: employee.bossId ?? null,
            employeeManningId: employee.manningId ?? null
        });
        const newSession = await db.getActiveSession(employee.barcode);
        return res.json({
            type: 'CHECKIN_DONE',
            payload: { employee, session: newSession },
            message: 'ПРИХОД зафиксирован: статус РАБОТА'
        });
    }

    // View Status Mode (No session today, no activity selected)
    return res.json({
        type: 'EMPLOYEE_SHOWN',
        payload: { employee, activeSession: null },
        message: 'Готов к началу работы (сканируйте Участок)'
    });
}

async function handleCommand(code: string, employeeBarcode: string, now: Date, res: Response) {
    if (!employeeBarcode || typeof employeeBarcode !== 'string' || employeeBarcode.trim() === '') {
        return res.json({ type: 'ERROR', message: 'Сначала отсканируйте ШК сотрудника' });
    }

    const activeSession = await db.getActiveSession(employeeBarcode.trim());

    if (!activeSession) {
        return res.json({ type: 'ERROR', message: 'Нет активной сессии для выполнения команды' });
    }

    if (code === 'BREAKTIME') {
        if (activeSession.status === 'WORK') {
            await db.updateSession(activeSession.id, { status: 'BREAK', breakStartedAt: now });
            return res.json({ type: 'BREAK_STARTED', message: 'ПЕРЕРЫВ начат' });
        } else {
            const breakStart = new Date(activeSession.breakStartedAt);
            const breakDuration = Math.round((now.getTime() - breakStart.getTime()) / 1000);
            const nightBreakDuration = calculateNightOverlap(breakStart, now);

            await db.updateSession(activeSession.id, {
                status: 'WORK',
                breakTotalSeconds: activeSession.breakTotalSeconds + breakDuration,
                breakNightSeconds: activeSession.breakNightSeconds + nightBreakDuration,
                breakStartedAt: null
            });
            return res.json({ type: 'BREAK_STOPPED', message: 'ПЕРЕРЫВ окончен' });
        }
    }

    if (code === 'EMPL_OUT') {
        let breakDuration = 0;
        let nightBreakDuration = 0;
        if (activeSession.status === 'BREAK') {
            const breakStart = new Date(activeSession.breakStartedAt);
            breakDuration = Math.round((now.getTime() - breakStart.getTime()) / 1000);
            nightBreakDuration = calculateNightOverlap(breakStart, now);
        }

        const totalNightOverlap = calculateNightOverlap(new Date(activeSession.inTime), now);
        const finalNightWorked = Math.max(0, totalNightOverlap - (activeSession.breakNightSeconds + nightBreakDuration));

        await db.updateSession(activeSession.id, {
            status: 'OUT',
            outTime: now,
            breakTotalSeconds: activeSession.breakTotalSeconds + breakDuration,
            breakNightSeconds: activeSession.breakNightSeconds + nightBreakDuration,
            nightWorkedSeconds: finalNightWorked,
            breakStartedAt: null
        });

        // Let's create a getSessionById or similar if needed, or just return basic info
        return res.json({
            type: 'CHECKOUT_DONE',
            payload: { ...activeSession, status: 'OUT', outTime: now, nightWorkedSeconds: finalNightWorked },
            message: 'УХОД зафиксирован. Уточните код вида времени у Бригадира/Старшего'
        });
    }

    if (code === 'TIME_1' || code === 'TIME_1_5' || code === 'TIME_2') {
        const timeType = code === 'TIME_1' ? 'X1' : code === 'TIME_1_5' ? 'X1_5' : 'X2';
        await db.updateSession(activeSession.id, { timeType });
        return res.json({ type: 'TIME_TYPE_SELECTED', payload: timeType, message: `Установлен коэффициент ${timeType.replace('_', '.')}` });
    }

    return res.json({ type: 'ERROR', message: 'Команда не поддерживается' });
}
