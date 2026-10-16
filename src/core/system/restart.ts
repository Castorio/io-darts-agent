/**
 * Hub restart
 *
 * Under a supervisor (systemd service, desktop app) the hub exits with a
 * dedicated code and the supervisor starts it again. Started by hand, it
 * launches a detached copy of itself and exits.
 */

import { spawn as nodeSpawn } from 'child_process';

/** Exit code that asks the supervisor for a restart (EX_TEMPFAIL) */
export const RESTART_EXIT_CODE = 75;

export type RestartStrategy = 'exit' | 'respawn';

export function restartStrategy(env: NodeJS.ProcessEnv): RestartStrategy {
  // Set by the systemd unit and the desktop app; INVOCATION_ID is not used
  // because shells started from a systemd user service inherit it
  return env.IO_DARTS_SUPERVISED ? 'exit' : 'respawn';
}

/** Command that started this process, including node flags such as loaders */
export function defaultCommand(execPath: string, execArgv: string[], argv: string[]): string[] {
  return [execPath, ...execArgv, ...argv.slice(1)];
}

export interface RestartDeps {
  env: NodeJS.ProcessEnv;
  argv: string[];
  cwd: string;
  spawn: (command: string, args: string[], options: object) => { unref(): void };
  exit: (code: number) => void;
}

export function restartProcess(deps: RestartDeps = defaultDeps()): void {
  if (restartStrategy(deps.env) === 'exit') {
    deps.exit(RESTART_EXIT_CODE);
    return;
  }

  const [command, ...args] = deps.argv;
  const child = deps.spawn(command, args, {
    cwd: deps.cwd,
    env: deps.env,
    detached: true,
    stdio: 'inherit',
  });
  child.unref();
  deps.exit(0);
}

function defaultDeps(): RestartDeps {
  return {
    env: process.env,
    argv: defaultCommand(process.execPath, process.execArgv, process.argv),
    cwd: process.cwd(),
    spawn: nodeSpawn as RestartDeps['spawn'],
    exit: (code) => process.exit(code),
  };
}
