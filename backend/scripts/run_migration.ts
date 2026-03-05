import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || '',
    port: parseInt(process.env.DB_PORT || '59587', 10),
    database: process.env.DB_NAME,
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

async function runMigration() {
    try {
        console.log(`Connecting to MSSQL at ${config.server}:${config.port}...`);
        const pool = await sql.connect(config);
        console.log('Connected!');

        const sqlPath = path.resolve(__dirname, '../sql/tables.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        // mssql package does not support 'GO' statements directly in queries.
        // We split the script by 'GO' and execute each batch sequentially.
        const batches = sqlContent.split(/^\s*GO\s*$/im);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`Executing batch ${i + 1}/${batches.length}...`);
                await pool.request().batch(batch);
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
