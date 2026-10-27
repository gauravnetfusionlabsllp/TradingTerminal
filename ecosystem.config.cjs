// pm2 process for PRODUCTION only (D:\deploy\sgfx-terminal). Built code, no file watching:
// editing source never restarts it — deploy.ps1 rebuilds and restarts it on purpose.
// Start by hand with `npm run prod:start`. cwd is absolute so even a dev checkout starts prod.
module.exports = {
  apps: [{
    name: 'sgfx-terminal-api',
    cwd: 'D:/deploy/sgfx-terminal/server',
    script: 'dist/index.js',
    env: { NODE_ENV: 'production' },
    watch: false,
    max_restarts: 10,
    restart_delay: 2000,
    time: true,
  }],
};
