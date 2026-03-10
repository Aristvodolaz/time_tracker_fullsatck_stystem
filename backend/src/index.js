import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleScan } from './controllers/scanController.js';
import { getEmployeeStatus, lookupEmployee, lookupActivity, listActivities, createActivity, bulkCreateActivities, deleteActivity } from './controllers/lookupController.js';
import { getReport, downloadExcelReport } from './controllers/reportController.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
// Registry routes
app.get('/api/lookup/employee', lookupEmployee);
app.get('/api/lookup/activity', lookupActivity);
app.get('/api/status/employee', getEmployeeStatus);
app.post('/api/scan', handleScan);
// Activities admin routes
app.get('/api/activities', listActivities);
app.post('/api/activities', createActivity);
app.post('/api/activities/bulk', bulkCreateActivities);
app.delete('/api/activities/:id', deleteActivity);
// Report routes
app.get('/api/report', getReport);
app.get('/api/report/excel', downloadExcelReport);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map