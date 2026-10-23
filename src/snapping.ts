import { CONFIG } from './config';

export function snapWithHysteresis(raw: number, previous: number | undefined, hysteresis = CONFIG.snapHysteresis) {
  return previous !== undefined && Math.abs(raw - previous) <= 0.5 + hysteresis ? previous : Math.round(raw);
}
