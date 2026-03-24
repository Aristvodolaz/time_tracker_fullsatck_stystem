import mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config: mssql.config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'icY2eGuyfU',
    server: process.env.DB_SERVER || 'PRM-SRV-MSSQL-01.komus.net',
    port: parseInt(process.env.DB_PORT || '59587'),
    database: process.env.DB_NAME || 'SPOe_rc',
    pool: {
        max: 500,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: true,
        enableArithAbort: true,
        trustServerCertificate: true
    }
};

export const poolPromise = new mssql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to MSSQL');
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed! ', err);
        throw err;
    });

// --- Employee Queries (MSSQL via OPENQUERY) ---
export async function queryEmployee(barcode: string) {
    try {
        if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
            return null;
        }

        const pool = await poolPromise;
        const empId = parseInt(barcode.trim(), 10);

        // If barcode is not a number, skip DB query (won't match int ID)
        if (!isNaN(empId)) {
            const result = await pool.request()
                .input('empId', mssql.Int, empId)
                .query(`
                    SELECT ID as barcode, BOSS_ID as bossId, FULL_NAME as fullName, NAME as shortName, MANNING_ID as manningId
                    FROM OPENQUERY(OW, 'SELECT ID, BOSS_ID, FULL_NAME, NAME, MANNING_ID FROM staff.employee')
                    WHERE ID = @empId
                `);
            if (result.recordset.length > 0) {
                const row = result.recordset[0];
                return { ...row, barcode: String(row.barcode) };
            }
        }

        // Fallback mock for dev
        if (process.env.NODE_ENV === 'development') {
            const mocks: any = {
                'EMP001': { barcode: 'EMP001', bossId: null, fullName: 'Иванов Иван Иванович (Mock)', shortName: 'Иванов И. И.', manningId: 2 },
                'EMP002': { barcode: 'EMP002', bossId: null, fullName: 'Петров Петр Петрович (Mock)', shortName: 'Петров П. П.', manningId: 3 }
            };
            return mocks[barcode.trim()] || null;
        }
        return null;
    } catch (err) {
        console.error('queryEmployee error', err);
        return null;
    }
}



// --- Activity Queries ---
export async function getActivity(barcode: string, zoneId?: string) {
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return null;
    }

    const pool = await poolPromise;
    let query = 'SELECT * FROM Activities WHERE activityBarcode = @barcode';
    if (zoneId) query += ' AND zoneId = @zoneId';

    const request = pool.request().input('barcode', mssql.NVarChar, barcode.trim());
    if (zoneId) request.input('zoneId', mssql.NVarChar, zoneId);

    const result = await request.query(query);
    return result.recordset[0] || null;
}

// --- Command Queries ---
export async function getCommand(barcode: string) {
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return null;
    }

    const pool = await poolPromise;
    const result = await pool.request()
        .input('barcode', mssql.NVarChar, barcode.trim())
        .query('SELECT * FROM Commands WHERE barcode = @barcode');
    return result.recordset[0] || null;
}

// Подразделение в отчёте: employee.manning_id (напр. 178 для ШК 62882000) = Departments.departmentNumber → выводим Departments.name
export async function getDepartmentName(manningId: number | string | null | undefined): Promise<string | null> {
    if (manningId == null || manningId === '') return null;
    let num: number;
    if (typeof manningId === 'number') num = manningId;
    else {
        const s = String(manningId).trim();
        const digits = s.replace(/\D/g, '');
        num = digits === '' ? NaN : parseInt(digits, 10);
    }
    if (isNaN(num)) return null;
    const pool = await poolPromise;
    const result = await pool.request()
        .input('departmentNumber', mssql.Int, num)
        .query('SELECT [name] FROM [dbo].[Departments] WHERE [departmentNumber] = @departmentNumber');
    const row = result.recordset[0];
    return row ? (row.name ?? null) : null;
}

// --- Session Queries ---
export async function getActiveSession(employeeBarcode: string) {
    if (!employeeBarcode || typeof employeeBarcode !== 'string' || employeeBarcode.trim() === '') {
        return null;
    }

    const pool = await poolPromise;
    const result = await pool.request()
        .input('barcode', mssql.NVarChar, employeeBarcode.trim())
        .query(`
            SELECT TOP 1 s.*, a.shortName, a.activityBarcode 
            FROM TimeSessions s
            JOIN Activities a ON s.activityId = a.id
            WHERE s.employeeBarcode = @barcode AND s.status IN ('WORK', 'BREAK')
            ORDER BY s.createdAt DESC
        `);
    return result.recordset[0] || null;
}

export async function getLastTodaySession(employeeBarcode: string) {
    if (!employeeBarcode || typeof employeeBarcode !== 'string' || employeeBarcode.trim() === '') {
        return null;
    }

    const pool = await poolPromise;
    const result = await pool.request()
        .input('barcode', mssql.NVarChar, employeeBarcode.trim())
        .query(`
            SELECT TOP 1 s.*, a.shortName, a.activityBarcode 
            FROM TimeSessions s
            JOIN Activities a ON s.activityId = a.id
            WHERE s.employeeBarcode = @barcode AND s.date = CAST(GETDATE() AS DATE)
            ORDER BY s.createdAt DESC
        `);
    return result.recordset[0] || null;
}

export async function createSession(data: { employeeBarcode: string, activityId: number, date: Date, inTime: Date, timeType: string }) {
    if (!data.employeeBarcode || typeof data.employeeBarcode !== 'string' || data.employeeBarcode.trim() === '') {
        throw new Error('Invalid employeeBarcode');
    }

    const pool = await poolPromise;
    await pool.request()
        .input('employeeBarcode', mssql.NVarChar, data.employeeBarcode.trim())
        .input('activityId', mssql.Int, data.activityId)
        .input('date', mssql.Date, data.date)
        .input('inTime', mssql.DateTime, data.inTime)
        .input('timeType', mssql.NVarChar, data.timeType)
        .query(`
            INSERT INTO TimeSessions (employeeBarcode, activityId, date, inTime, status, timeType, breakTotalSeconds, breakNightSeconds, nightWorkedSeconds)
            VALUES (@employeeBarcode, @activityId, @date, @inTime, 'WORK', @timeType, 0, 0, 0)
        `);
}

export async function updateSession(id: string, updates: any) {
    const pool = await poolPromise;
    let setClause = Object.keys(updates).map(key => `${key} = @${key}`).join(', ');
    const request = pool.request().input('id', mssql.UniqueIdentifier, id);

    Object.keys(updates).forEach(key => {
        if (key === 'breakTotalSeconds' || key === 'breakNightSeconds' || key === 'nightWorkedSeconds') {
            request.input(key, mssql.Int, updates[key]);
        } else if (key.endsWith('At') || key.endsWith('Time')) {
            request.input(key, mssql.DateTime, updates[key]);
        } else {
            request.input(key, mssql.NVarChar, updates[key]);
        }
    });

    await request.query(`UPDATE TimeSessions SET ${setClause}, updatedAt = GETDATE() WHERE id = @id`);
}

export async function getSessionsForReport(dateFrom?: string, dateTo?: string) {
    const pool = await poolPromise;
    // Явные колонки + алиасы: без s.*, чтобы activityBarcode/shortName всегда шли из Activities (драйвер не терял поля)
    let query = `
        SELECT
            s.id, s.employeeBarcode, s.activityId, s.date, s.inTime, s.outTime, s.status,
            s.breakTotalSeconds, s.breakNightSeconds, s.nightWorkedSeconds, s.breakStartedAt, s.timeType,
            s.createdAt, s.updatedAt,
            a.activityBarcode AS activityBarcode,
            a.shortName AS shortName
        FROM TimeSessions s
        INNER JOIN Activities a ON s.activityId = a.id
        WHERE 1=1
    `;
    const request = pool.request();
    if (dateFrom) {
        request.input('from', mssql.Date, dateFrom);
        query += ' AND s.date >= @from';
    }
    if (dateTo) {
        request.input('to', mssql.Date, dateTo);
        query += ' AND s.date <= @to';
    }
    query += ' ORDER BY s.employeeBarcode, s.inTime';
    const result = await request.query(query);
    return result.recordset;
}

// --- Activities CRUD (Admin) ---
export async function getAllActivities() {
    const pool = await poolPromise;
    const result = await pool.request()
        .query('SELECT * FROM Activities ORDER BY zoneId, shortName');
    return result.recordset;
}

export async function insertActivity(data: { zoneId: string, activityBarcode: string, fullName: string, shortName: string, metric?: string }) {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('zoneId', mssql.NVarChar, data.zoneId)
        .input('activityBarcode', mssql.NVarChar, data.activityBarcode)
        .input('fullName', mssql.NVarChar, data.fullName)
        .input('shortName', mssql.NVarChar, data.shortName)
        .input('metric', mssql.NVarChar, data.metric || null)
        .query(`
            INSERT INTO Activities (zoneId, activityBarcode, fullName, shortName, metric)
            OUTPUT INSERTED.id
            VALUES (@zoneId, @activityBarcode, @fullName, @shortName, @metric)
        `);
    return result.recordset[0]?.id;
}

export async function removeActivity(id: number) {
    const pool = await poolPromise;
    await pool.request()
        .input('id', mssql.Int, id)
        .query('DELETE FROM Activities WHERE id = @id');
}

