// Runs a command at idle priority and stops it if the machine runs short of memory commit (the page file included),
// so a build or a browser run cannot starve a game or other programs.
//   node lowpri.cjs <command> [args...]       MIN_COMMIT_HEADROOM_MB (default 1024) is the headroom that stops the command
const os = require('os');
const { spawn, execFileSync } = require('child_process');

try { os.setPriority(0, os.constants.priority.PRIORITY_LOW); } catch (error) { console.error('lowpri: could not lower priority', error.message); }

const floorMb = Number(process.env.MIN_COMMIT_HEADROOM_MB ?? 1024);
const headroomMb = () => Number(execFileSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory'], { encoding: 'utf8' })) / 1024;

const child = spawn(process.argv[2], process.argv.slice(3), { stdio: 'inherit' });
let stopped = false;
const watch = setInterval(() => {
  try {
    const free = headroomMb();
    if (free < floorMb) {
      stopped = true;
      console.error(`lowpri: only ${free.toFixed(0)} MB of commit headroom left (floor ${floorMb} MB), stopping ${process.argv[2]}`);
      execFileSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
    }
  } catch { /* the child may already be gone */ }
}, 10000);
child.on('error', error => { console.error(error.message); process.exit(1); });
child.on('exit', code => {
  clearInterval(watch);
  process.exit(stopped ? 75 : code ?? 1);
});
