import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from './logger';
import { EXTENSION_LOG_PREFIX } from '../config/site';

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not emit a message when the level is below the minimum level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const logger = createLogger('test-scope', 'warn');
    logger.debug('debug message');
    logger.info('info message');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('should emit a message when the level meets the minimum level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const logger = createLogger('test-scope', 'warn');
    logger.warn('warn message');

    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('should emit a structured log entry with all required fields', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const logger = createLogger('my-scope', 'debug');
    logger.warn('hello world');

    expect(warnSpy).toHaveBeenCalledWith(
      EXTENSION_LOG_PREFIX,
      expect.objectContaining({
        level: 'warn',
        scope: 'my-scope',
        message: 'hello world',
        timestamp: expect.any(String) as unknown,
      }),
    );
  });

  it('should pass context through to the log entry', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const logger = createLogger('test-scope', 'debug');
    logger.info('with context', { key: 'value', count: 42 });

    expect(infoSpy).toHaveBeenCalledWith(
      EXTENSION_LOG_PREFIX,
      expect.objectContaining({
        context: { key: 'value', count: 42 },
      }),
    );
  });

  it('should use the correct console method for each log level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const logger = createLogger('test-scope', 'debug');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
