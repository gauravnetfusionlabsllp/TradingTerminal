// pm2 process for PRODUCTION only (D:\deploy\sgfx-terminal). Built code, no file watching:
// editing source never restarts it — deploy.ps1 rebuilds and restarts it on purpose.
module.exports = {
  apps: [{
    name: 'sgfx-api',
    cwd: __dirname + '/server',
    script: 'dist/index.js',
    env: { NODE_ENV: 'production' },
    watch: false,
    max_restarts: 10,
    restart_delay: 2000,
    time: true,
  }],
};
