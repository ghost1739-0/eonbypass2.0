/**
 * Returns true for runtime module files (.js in production, .ts in dev).
 * Excludes TypeScript declaration (.d.ts) and source map files.
 */
export function isLoadableModuleFile(filename: string): boolean {
  if (filename.endsWith('.d.ts') || filename.endsWith('.js.map')) {
    return false;
  }

  const runningFromDist = __dirname.includes(`${pathSep()}dist${pathSep()}`);

  if (runningFromDist) {
    return filename.endsWith('.js');
  }

  return filename.endsWith('.ts') || filename.endsWith('.js');
}

function pathSep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}
