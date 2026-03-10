import type { Request, Response } from 'express';
export declare const lookupEmployee: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const lookupActivity: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getEmployeeStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const listActivities: (_req: Request, res: Response) => Promise<void>;
export declare const createActivity: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const bulkCreateActivities: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteActivity: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=lookupController.d.ts.map