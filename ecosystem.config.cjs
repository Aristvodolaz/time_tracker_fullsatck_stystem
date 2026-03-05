module.exports = {
    apps: [
        {
            name: 'time-tracker-backend',
            cwd: './backend',
            script: 'npm',
            args: 'run dev',
            env: {
                PORT: 3020,
                NODE_ENV: 'production'
            }
        },
        {
            name: 'time-tracker-frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'run dev',
            env: {
                VITE_PORT: 3021,
                NODE_ENV: 'production'
            }
        }
    ]
};
