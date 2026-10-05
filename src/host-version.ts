/** Match Store compatibility: compare stable core, while accepting valid metadata. */
export function supportsDailyBriefHost(version: string): boolean {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match) return false;
  if (match[4]?.split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) return false;
  const core = match.slice(1, 4).map(BigInt);
  const minimum = [0n, 6n, 11n];
  for (let index = 0; index < minimum.length; index++) {
    if (core[index] !== minimum[index]) return core[index] > minimum[index];
  }
  return true;
}
