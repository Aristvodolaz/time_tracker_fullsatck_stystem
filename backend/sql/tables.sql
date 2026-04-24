-- SQL DDL for Time Tracker Application
-- Database: SPOe_rc
-- Use this script to create the necessary tables for the application.

-- 1. Activities Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Activities]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Activities] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [zoneId] NVARCHAR(50) NOT NULL,
        [activityBarcode] NVARCHAR(100) NOT NULL UNIQUE,
        [fullName] NVARCHAR(255) NOT NULL,
        [shortName] NVARCHAR(100) NOT NULL UNIQUE,
        [metric] NVARCHAR(100) NULL,
        [createdAt] DATETIME DEFAULT GETDATE(),
        [updatedAt] DATETIME DEFAULT GETDATE()
    );
END
GO

-- 2. Commands Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Commands]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Commands] (
        [code] NVARCHAR(50) PRIMARY KEY, -- BREAKTIME, EMPL_OUT, TIME_1_5, TIME_2
        [barcode] NVARCHAR(100) NOT NULL UNIQUE,
        [title] NVARCHAR(255) NOT NULL,
        [createdAt] DATETIME DEFAULT GETDATE(),
        [updatedAt] DATETIME DEFAULT GETDATE()
    );
END
GO

-- 3. TimeSessions Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TimeSessions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[TimeSessions] (
        [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [employeeBarcode] NVARCHAR(100) NOT NULL,
        [activityId] INT NOT NULL,
        [date] DATE NOT NULL,
        [inTime] DATETIME NOT NULL,
        [outTime] DATETIME NULL,
        [status] NVARCHAR(20) NOT NULL DEFAULT 'WORK', -- WORK, BREAK, OUT
        [breakTotalSeconds] INT DEFAULT 0,
        [breakNightSeconds] INT DEFAULT 0,
        [nightWorkedSeconds] INT DEFAULT 0,
        [breakStartedAt] DATETIME NULL,
        [timeType] NVARCHAR(20) DEFAULT 'X1', -- X1, X1_5, X2, NIGHT
        [createdAt] DATETIME DEFAULT GETDATE(),
        [updatedAt] DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_Session_Activity FOREIGN KEY (activityId) REFERENCES Activities(id)
    );
    CREATE INDEX IX_TimeSessions_Employee_Date ON [dbo].[TimeSessions] (employeeBarcode, date);
END
GO

-- 3b. Migration: add cached employee info columns to TimeSessions (safe to re-run)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TimeSessions]') AND name = 'employeeFullName')
    ALTER TABLE [dbo].[TimeSessions] ADD [employeeFullName] NVARCHAR(255) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TimeSessions]') AND name = 'employeeBossId')
    ALTER TABLE [dbo].[TimeSessions] ADD [employeeBossId] NVARCHAR(50) NULL;
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[TimeSessions]') AND name = 'employeeManningId')
    ALTER TABLE [dbo].[TimeSessions] ADD [employeeManningId] INT NULL;
GO

-- 4. Seed basic commands
IF NOT EXISTS (SELECT * FROM [dbo].[Commands] WHERE [code] = 'BREAKTIME')
    INSERT INTO [dbo].[Commands] ([code], [barcode], [title]) VALUES ('BREAKTIME', 'CMD_BREAK', 'Перерыв');
IF NOT EXISTS (SELECT * FROM [dbo].[Commands] WHERE [code] = 'EMPL_OUT')
    INSERT INTO [dbo].[Commands] ([code], [barcode], [title]) VALUES ('EMPL_OUT', 'CMD_OUT', 'Уход');
IF NOT EXISTS (SELECT * FROM [dbo].[Commands] WHERE [code] = 'TIME_1')
    INSERT INTO [dbo].[Commands] ([code], [barcode], [title]) VALUES ('TIME_1', 'CMD_X1', 'Коэфф 1');
IF NOT EXISTS (SELECT * FROM [dbo].[Commands] WHERE [code] = 'TIME_1_5')
    INSERT INTO [dbo].[Commands] ([code], [barcode], [title]) VALUES ('TIME_1_5', 'CMD_X1_5', 'Коэфф 1.5');
IF NOT EXISTS (SELECT * FROM [dbo].[Commands] WHERE [code] = 'TIME_2')
    INSERT INTO [dbo].[Commands] ([code], [barcode], [title]) VALUES ('TIME_2', 'CMD_X2', 'Коэфф 2');
GO

-- 5. Seed example activities for Zone 1
IF NOT EXISTS (SELECT * FROM [dbo].[Activities] WHERE [activityBarcode] = 'ACT001')
    INSERT INTO [dbo].[Activities] (zoneId, activityBarcode, fullName, shortName, metric) 
    VALUES ('ZONE1', 'ACT001', 'Комплектация заказов', 'Комплектация', 'смена 1');
IF NOT EXISTS (SELECT * FROM [dbo].[Activities] WHERE [activityBarcode] = 'ACT002')
    INSERT INTO [dbo].[Activities] (zoneId, activityBarcode, fullName, shortName, metric) 
    VALUES ('ZONE1', 'ACT002', 'Приемка товара', 'Приемка', 'смена 2');
GO
