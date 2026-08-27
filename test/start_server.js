const { spawn } = require('child_process');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL_TEST,
  NEXTAUTH_URL: 'http://localhost:3100',
  PORT: '3100'
};

const server = spawn('npx', ['next', 'dev', '-p', '3100'], { env, stdio: 'inherit', shell: true });

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});
