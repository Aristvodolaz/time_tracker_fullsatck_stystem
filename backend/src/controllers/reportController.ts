import type { Request, Response } from 'express';
import * as db from '../db.js';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export const getReport = async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = req.query;
    const sessions = await db.getSessionsForReport(dateFrom as string, dateTo as string);
    // Связка: staff.employee.MANNING_ID = Departments.departmentNumber -> подставляем Departments.name в отчёт
    const enriched = await Promise.all(sessions.map(async (s: any) => {
        const emp = await db.queryEmployee(s.employeeBarcode);
        const departmentName = await db.getDepartmentName(emp?.manningId ?? null);
        return {
            ...s,
            fullName: emp?.fullName || '',
            bossId: emp?.bossId ?? '',
            manningId: emp?.manningId ?? null,
            departmentName: departmentName || ''
        };
    }));
    res.json(enriched);
};

// Format seconds as H:MM
function fmtHM(seconds: number): string {
    if (!seconds || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}`;
}

export const downloadExcelReport = async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = req.query;
    const baseSessions = await db.getSessionsForReport(dateFrom as string, dateTo as string);

    // Сотрудник ШК → employee.manning_id → Departments: departmentNumber = manning_id → name в отчёт (напр. ШК 62882000 → manning_id 178 → Departments[178].name)
    const enrichedSessions = await Promise.all(baseSessions.map(async (s: any) => {
        const emp = await db.queryEmployee(s.employeeBarcode);
        const departmentName = await db.getDepartmentName(emp?.manningId ?? null);
        return {
            ...s,
            employee: emp || { fullName: 'Unknown', bossId: '-', manningId: null },
            departmentName: departmentName || ''
        };
    }));

    // Group by employee + date and sort by inTime
    const grouped: any = {};
    enrichedSessions.forEach(s => {
        const key = `${s.employeeBarcode}_${format(new Date(s.date), 'yyyy-MM-dd')}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
    });
    
    // Sort each group by inTime to ensure correct н+1 numbering
    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a: any, b: any) => 
            new Date(a.inTime).getTime() - new Date(b.inTime).getTime()
        );
    });

    // Headers matching the screenshot format exactly
    const headers = [
        'ШК сотрудника', 'Boss ID', 'ФИО',
        'Основной Код активности (Подразделение)',
        'Код активности 1',
        'Итого времени', 'Ночные итого',
        // Activity 1 detail columns
        'Дата прихода активность 1',
        'Время прихода активность 1',
        'Время ухода активность 1',
        'Итоговое время на активности 1 x1, ч',
        'Перерыв 1',
        'Активность 1, вид времени x1.5',
        'Активность 1, вид времени x2',
        'Активность 1, вид времени Ночь',
        // Activity 2
        'Код активности 2',
        'Время прихода активность 2',
        'Время ухода активность 2',
        'Итоговое время на активности 2 x1, ч',
        'Активность 2, вид времени x1.5',
        'Активность 2, вид времени x2',
        'Активность 2, вид времени Ночь',
        // Activity 3
        'Код активности 3',
        'Время прихода активность 3',
        'Время ухода активность 3',
        'Итоговое время на активности 3 x1, ч',
        'Активность 3, вид времени x1.5',
        'Активность 3, вид времени x2',
        'Активность 3, вид времени Ночь',
        // Activity 4
        'Код активности 4',
        'Время прихода активность 4',
        'Время ухода активность 4',
        'Итоговое время на активности 4 x1, ч',
        'Активность 4, вид времени x1.5',
        'Активность 4, вид времени x2',
        'Активность 4, вид времени Ночь',
    ];

    const rows: any[] = [];
    Object.values(grouped).forEach((group: any) => {
        const first = group[0];
        const row: any = {
            'ШК сотрудника': first.employeeBarcode,
            'Boss ID': first.employee.bossId,
            'ФИО': first.employee.fullName,
        };

        let totalWorkedSeconds = 0;
        let totalNightSeconds = 0;

        // Helper: fill activity columns
        const fillActivity = (s: any, n: number) => {
            const inTime = new Date(s.inTime);
            const outTime = s.outTime ? new Date(s.outTime) : null;
            const workedSeconds = outTime
                ? Math.round((outTime.getTime() - inTime.getTime()) / 1000) - (s.breakTotalSeconds || 0)
                : 0;
            const nightSeconds = s.nightWorkedSeconds || 0;
            const timeType = s.timeType || 'X1';

            totalWorkedSeconds += workedSeconds;
            totalNightSeconds += nightSeconds;

            if (n === 1) {
                row['Дата прихода активность 1'] = format(inTime, 'dd.MM.yyyy');
                row['Перерыв 1'] = fmtHM(s.breakTotalSeconds || 0);
            }

            row[`Время прихода активность ${n}`] = format(inTime, 'HH:mm');
            row[`Время ухода активность ${n}`] = outTime ? format(outTime, 'HH:mm') : '';
            row[`Итоговое время на активности ${n} x1, ч`] = fmtHM(workedSeconds);
            row[`Активность ${n}, вид времени x1.5`] = timeType === 'X1_5' ? fmtHM(workedSeconds) : '';
            row[`Активность ${n}, вид времени x2`] = timeType === 'X2' ? fmtHM(workedSeconds) : '';
            row[`Активность ${n}, вид времени Ночь`] = fmtHM(nightSeconds);
        };

        // Только Departments.name (без подстановки кода активности)
        row['Основной Код активности (Подразделение)'] = first.departmentName ?? '';

        // Все смены за день подряд (н+1), максимум 4 блока в шаблоне Excel — одна ветка для 1 и для N смен
        const sessionCount = Math.min(group.length, 4);
        for (let i = 0; i < sessionCount; i++) {
            const s = group[i];
            const n = i + 1;
            const barcode = s.activityBarcode;
            row[`Код активности ${n}`] = barcode != null && String(barcode).trim() !== '' ? String(barcode) : '';
            fillActivity(s, n);
        }

        row['Итого времени'] = fmtHM(totalWorkedSeconds);
        row['Ночные итого'] = fmtHM(totalNightSeconds);

        rows.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Records');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="time_tracker_report.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
};
