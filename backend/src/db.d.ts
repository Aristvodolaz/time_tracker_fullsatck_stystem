import mssql from 'mssql';
export declare const poolPromise: Promise<mssql.ConnectionPool>;
export declare function queryEmployee(barcode: string): Promise<any>;
export declare function getActivity(barcode: string, zoneId?: string): Promise<any>;
export declare function getCommand(barcode: string): Promise<any>;
export declare function getDepartmentName(manningId: number | string | null | undefined): Promise<string | null>;
export declare function getActiveSession(employeeBarcode: string): Promise<any>;
export declare function getLastTodaySession(employeeBarcode: string): Promise<any>;
export declare function createSession(data: {
    employeeBarcode: string;
    activityId: number;
    date: Date;
    inTime: Date;
    timeType: string;
    employeeFullName?: string | null;
    employeeBossId?: string | number | null;
    employeeManningId?: number | null;
}): Promise<void>;
export declare function updateSession(id: string, updates: any): Promise<void>;
export declare function getSessionsForReport(dateFrom?: string, dateTo?: string): Promise<mssql.IRecordSet<any>>;
export declare function getAllActivities(): Promise<mssql.IRecordSet<any>>;
export declare function insertActivity(data: {
    zoneId: string;
    activityBarcode: string;
    fullName: string;
    shortName: string;
    metric?: string;
}): Promise<any>;
export declare function removeActivity(id: number): Promise<void>;
//# sourceMappingURL=db.d.ts.map