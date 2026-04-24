import type { Request, Response } from 'express';
import * as db from '../db.js';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Календарный день строки отчёта: как в Excel, так и на экране — одна дата = одна логическая строка (без сдвига UTC на «YYYY-MM-DD» из SQL)
function reportDayKey(raw: Date | string | undefined | null): string {
    if (raw == null || raw === '') return '';
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    }
    return format(new Date(raw as string | Date), 'yyyy-MM-dd');
}

export const getReport = async (req: Request, res: Response) => {
    const { dateFrom, dateTo } = req.query;
    const sessions = await db.getSessionsForReport(dateFrom as string, dateTo as string);

    // Sequential lookup per unique barcode to avoid parallel OPENQUERY overload on linked server
    const uniqueBarcodes = [...new Set((sessions as any[]).map((s: any) => s.employeeBarcode).filter(Boolean))];
    const empMap = new Map<string, any>();
    for (const barcode of uniqueBarcodes) {
        const emp = await db.queryEmployee(barcode);
        if (emp) empMap.set(barcode, emp);
    }

    // Sequential lookup for unique department names
    const uniqueManningIds = [...new Set([...empMap.values()].map((e: any) => e.manningId).filter((v: any) => v != null))];
    const deptMap = new Map<number, string>();
    for (const id of uniqueManningIds) {
        const name = await db.getDepartmentName(id);
        if (name) deptMap.set(id, name);
    }

    const enriched = (sessions as any[]).map((s: any) => {
        const emp = empMap.get(s.employeeBarcode);
        const departmentName = deptMap.get(emp?.manningId) ?? '';
        return {
            ...s,
            fullName: emp?.fullName || '',
            bossId: emp?.bossId ?? '',
            manningId: emp?.manningId ?? null,
            departmentName
        };
    });
    enriched.sort((a: any, b: any) => {
        const da = reportDayKey(a.date);
        const db = reportDayKey(b.date);
        if (da !== db) return da.localeCompare(db);
        const bc = String(a.employeeBarcode ?? '').localeCompare(String(b.employeeBarcode ?? ''));
        if (bc !== 0) return bc;
        return new Date(a.inTime).getTime() - new Date(b.inTime).getTime();
    });
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

    // Sequential lookup per unique barcode to avoid parallel OPENQUERY overload on linked server
    const uniqueBarcodes = [...new Set((baseSessions as any[]).map((s: any) => s.employeeBarcode).filter(Boolean))];
    const empMap = new Map<string, any>();
    for (const barcode of uniqueBarcodes) {
        const emp = await db.queryEmployee(barcode);
        if (emp) empMap.set(barcode, emp);
    }

    // Sequential lookup for unique department names
    const uniqueManningIds = [...new Set([...empMap.values()].map((e: any) => e.manningId).filter((v: any) => v != null))];
    const deptMap = new Map<number, string>();
    for (const id of uniqueManningIds) {
        const name = await db.getDepartmentName(id);
        if (name) deptMap.set(id, name);
    }

    const enrichedSessions = (baseSessions as any[]).map((s: any) => {
        const emp = empMap.get(s.employeeBarcode);
        const departmentName = deptMap.get(emp?.manningId) ?? '';
        return {
            ...s,
            employee: emp || { fullName: '', bossId: '', manningId: null },
            departmentName
        };
    });

    // Group by employee + date and sort by inTime
    const grouped: any = {};
    enrichedSessions.forEach(s => {
        const key = `${s.employeeBarcode}_${reportDayKey(s.date)}`;
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
        'Наименование активности 1',
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
        'Наименование активности 2',
        'Время прихода активность 2',
        'Время ухода активность 2',
        'Итоговое время на активности 2 x1, ч',
        'Активность 2, вид времени x1.5',
        'Активность 2, вид времени x2',
        'Активность 2, вид времени Ночь',
        // Activity 3
        'Код активности 3',
        'Наименование активности 3',
        'Время прихода активность 3',
        'Время ухода активность 3',
        'Итоговое время на активности 3 x1, ч',
        'Активность 3, вид времени x1.5',
        'Активность 3, вид времени x2',
        'Активность 3, вид времени Ночь',
        // Activity 4
        'Код активности 4',
        'Наименование активности 4',
        'Время прихода активность 4',
        'Время ухода активность 4',
        'Итоговое время на активности 4 x1, ч',
        'Активность 4, вид времени x1.5',
        'Активность 4, вид времени x2',
        'Активность 4, вид времени Ночь',
    ];

    // Сначала дата, потом ШК — при периоде в несколько дней каждый день идёт отдельным блоком строк
    const sortedGroups = (Object.values(grouped) as any[][]).sort((a: any[], b: any[]) => {
        const da = reportDayKey(a[0]?.date);
        const db = reportDayKey(b[0]?.date);
        if (da !== db) return da.localeCompare(db);
        return String(a[0]?.employeeBarcode ?? '').localeCompare(String(b[0]?.employeeBarcode ?? ''));
    });

    const rows: any[] = [];
    sortedGroups.forEach((group: any) => {
        const first = group[0];
        const row: any = {
            'ШК сотрудника': first.employeeBarcode,
            'Boss ID': first.employee.bossId,
            'ФИО': first.employee.fullName,
        };

        // DEBUG: проверяем, есть ли activityBarcode у всех сессий в группе
        console.log(`[Excel Row] ШК=${first.employeeBarcode}, дата=${reportDayKey(first.date)}, смен=${group.length}`);
        group.forEach((s: any, idx: number) => {
            console.log(`  смена ${idx + 1}: activityBarcode="${s.activityBarcode}", activityId=${s.activityId}`);
        });

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
            row[`Наименование активности ${n}`] = s.shortName || '';
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
