import { spawn } from 'node:child_process';
import { emulatorEnv } from './emulator-env.mjs';
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '1234'], {
  stdio: 'inherit', env: { ...process.env, ...emulatorEnv }, windowsHide: true,
});
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
