module.exports = {
  apps: [
    {
      name: 'vsp-web',
      cwd: './web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        NEXT_PUBLIC_API_URL: 'https://api.vspphone.com',
      },
    },
  ],
};
