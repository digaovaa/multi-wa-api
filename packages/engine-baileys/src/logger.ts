import type { Logger } from '@multi-wa/core'

export interface BaileysLogger {
  level: string
  child(bindings: Record<string, unknown>): BaileysLogger
  trace(obj: unknown, msg?: string): void
  debug(obj: unknown, msg?: string): void
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export function toBaileysLogger(logger: Logger): BaileysLogger {
  const bind =
    (level: Level) =>
    (obj: unknown, msg?: string): void => {
      if (typeof obj === 'string') logger[level](obj)
      else logger[level](obj as Record<string, unknown>, msg)
    }
  return {
    level: logger.level,
    child: (bindings) => toBaileysLogger(logger.child(bindings)),
    trace: bind('trace'),
    debug: bind('debug'),
    info: bind('info'),
    warn: bind('warn'),
    error: bind('error')
  }
}
