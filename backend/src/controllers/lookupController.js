import * as db from '../db.js';
export const lookupEmployee = async (req, res) => {
    const { barcode } = req.query;
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({ message: 'Barcode is required' });
    }
    const employee = await db.queryEmployee(barcode.trim());
    if (!employee) {
        return res.status(404).json({ message: 'ШК сотрудника не действителен. Проверьте свой ШК' });
    }
    res.json(employee);
};
export const lookupActivity = async (req, res) => {
    const { barcode, zoneId } = req.query;
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({ message: 'Barcode is required' });
    }
    const activity = await db.getActivity(barcode.trim(), zoneId);
    if (!activity) {
        return res.status(404).json({ message: 'Активность не найдена - отсканирован ШК активности отсутствующей в БД.' });
    }
    res.json(activity);
};
export const getEmployeeStatus = async (req, res) => {
    const { barcode } = req.query;
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
        return res.status(400).json({ message: 'Barcode is required' });
    }
    const lastSession = await db.getActiveSession(barcode.trim());
    if (!lastSession) {
        return res.json({ status: 'OUT', message: 'Нет активных сессий' });
    }
    res.json(lastSession);
};
// ── Activities CRUD ──────────────────────────────────────────────────────────
export const listActivities = async (_req, res) => {
    try {
        const activities = await db.getAllActivities();
        res.json(activities);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
export const createActivity = async (req, res) => {
    const { zoneId, activityBarcode, fullName, shortName, metric } = req.body;
    if (!zoneId || !activityBarcode || !fullName || !shortName) {
        return res.status(400).json({ message: 'zoneId, activityBarcode, fullName, shortName are required' });
    }
    try {
        const id = await db.insertActivity({ zoneId, activityBarcode, fullName, shortName, metric });
        res.json({ id, message: 'Активность создана' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
export const bulkCreateActivities = async (req, res) => {
    const { activities } = req.body;
    if (!Array.isArray(activities) || activities.length === 0) {
        return res.status(400).json({ message: 'activities[] required' });
    }
    const results = { created: 0, skipped: 0, errors: [] };
    for (const act of activities) {
        try {
            await db.insertActivity(act);
            results.created++;
        }
        catch (err) {
            results.skipped++;
            results.errors.push(`${act.activityBarcode}: ${err.message}`);
        }
    }
    res.json(results);
};
export const deleteActivity = async (req, res) => {
    const id = req.params.id;
    if (id === undefined || id === '') {
        return res.status(400).json({ message: 'ID обязателен' });
    }
    try {
        await db.removeActivity(parseInt(id, 10));
        res.json({ message: 'Удалено' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
//# sourceMappingURL=lookupController.js.map