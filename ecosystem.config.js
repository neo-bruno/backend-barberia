module.exports = {
  apps: [{
    name: 'backend',
    script: './src/server.js',
    env: {
      TZ: 'America/La_Paz'
    }
  }]
}