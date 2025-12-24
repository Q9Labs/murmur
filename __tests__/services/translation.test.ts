import { TranslationService } from '@/services/translation';

describe('TranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('falls back to non-stream response when streaming body is unavailable', async () => {
    const onChunk = jest.fn();
    const onComplete = jest.fn();
    const onError = jest.fn();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hola' } }],
        }),
      });

    const service = new TranslationService('test-key');
    await service.translateStream('Hello', 'Spanish', onChunk, onComplete, onError);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondCallBody.stream).toBe(false);
    expect(onChunk).toHaveBeenCalledWith('Hola');
    expect(onComplete).toHaveBeenCalledWith('Hola');
    expect(onError).not.toHaveBeenCalled();
  });

  it('streams translation chunks when response body is available', async () => {
    const onChunk = jest.fn();
    const onComplete = jest.fn();
    const onError = jest.fn();

    const encoder = new TextEncoder();
    const firstChunk = encoder.encode(
      'data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n'
    );

    const reader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: firstChunk })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () => reader,
      },
    });

    const service = new TranslationService('test-key');
    await service.translateStream('Hello', 'Spanish', onChunk, onComplete, onError);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('Hola');
    expect(onComplete).toHaveBeenCalledWith('Hola');
    expect(onError).not.toHaveBeenCalled();
  });
});
