-- Delete old activities and related time sessions
-- This script removes the old activity records and all associated time sessions

-- Step 1: Find old activities to delete
DECLARE @OldActivityIds TABLE (id INT);

INSERT INTO @OldActivityIds (id)
SELECT id FROM [dbo].[Activities]
WHERE activityBarcode IN (
    'ТЗК', 'ТЗКарт', 'ТЗУ', 'ТЗКор', 'ТЗП',
    'Т2К', 'Т2П', 'Т2С', 'Т2У',
    'МК', 'МП', 'МДТС', 'МДТУ', 'МВК', 'МВУ',
    'Балк-IFD', 'Балк-КК', 'Балк-ШК'
);

-- Show what will be deleted
SELECT 'OLD ACTIVITIES TO DELETE:' AS Info;
SELECT id, zoneId, activityBarcode, shortName, metric
FROM [dbo].[Activities]
WHERE id IN (SELECT id FROM @OldActivityIds)
ORDER BY zoneId, activityBarcode;

SELECT 'SESSIONS TO DELETE:' AS Info;
SELECT COUNT(*) AS SessionsToDelete
FROM [dbo].[TimeSessions]
WHERE activityId IN (SELECT id FROM @OldActivityIds);

-- Step 2: Delete related TimeSessions (must be first due to FK constraint)
DELETE FROM [dbo].[TimeSessions]
WHERE activityId IN (SELECT id FROM @OldActivityIds);

PRINT 'Deleted TimeSessions: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- Step 3: Delete old Activities
DELETE FROM [dbo].[Activities]
WHERE id IN (SELECT id FROM @OldActivityIds);

PRINT 'Deleted Activities: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));

-- Verify deletion
SELECT 'REMAINING ACTIVITIES:' AS Info;
SELECT COUNT(*) AS RemainingActivities FROM [dbo].[Activities];

PRINT 'Old activities and related sessions successfully deleted!';
GO
