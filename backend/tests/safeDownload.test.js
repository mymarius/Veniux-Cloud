const dns = require('dns').promises;
const { fetchSafely } = require('../src/services/medicines/safeDownload');
const options = { allowedHosts: ['titck.gov.tr'], maxBytes: 100 };
const url = 'https://www.titck.gov.tr/list.xlsx';
const response = body => ({ ok: true, status: 200, headers: new Headers(), body });

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  jest.spyOn(global, 'fetch');
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('retries a reset during body download without retaining partial bytes', async () => {
  global.fetch.mockResolvedValueOnce(response((async function* () {
    yield Buffer.from('partial');
    throw Object.assign(new Error('reset'), { cause: { code: 'ECONNRESET' } });
  })())).mockResolvedValueOnce(response([Buffer.from('complete')]));
  const pending = fetchSafely(url, options);
  await jest.runAllTimersAsync();
  expect((await pending).buffer.toString()).toBe('complete');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1].signal).not.toBe(fetch.mock.calls[1][1].signal);
});

test('retries temporary HTTP failures', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
    .mockResolvedValueOnce(response([Buffer.from('ok')]));
  const pending = fetchSafely(url, options);
  await jest.runAllTimersAsync();
  expect((await pending).buffer.toString()).toBe('ok');
});

test('does not retry size violations', async () => {
  global.fetch.mockResolvedValue(response([Buffer.alloc(101)]));
  await expect(fetchSafely(url, options)).rejects.toThrow('boyut');
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('still rejects redirect targets outside the allowlist', async () => {
  global.fetch.mockResolvedValue({ status: 302, headers: new Headers({ location: 'https://example.com/file' }) });
  await expect(fetchSafely(url, options)).rejects.toThrow('İzin verilmeyen');
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('bounds repeated connection resets', async () => {
  global.fetch.mockRejectedValue(Object.assign(new Error('reset'), { cause: { code: 'ECONNRESET' } }));
  const pending = expect(fetchSafely(url, options)).rejects.toMatchObject({ retryable: true });
  await jest.runAllTimersAsync();
  await pending;
  expect(fetch).toHaveBeenCalledTimes(4);
});
