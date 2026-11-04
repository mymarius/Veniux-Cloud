jest.mock('mysql2/promise', () => ({ createConnection: jest.fn(), createPool: jest.fn() }));
const mysql = require('mysql2/promise');
const { initMySQL } = require('../src/config/mysqlAdapter');

test('test startup never opens a MySQL connection', async () => {
  expect(process.env.NODE_ENV).toBe('test');
  expect(await initMySQL()).toBe(false);
  expect(mysql.createConnection).not.toHaveBeenCalled();
  expect(mysql.createPool).not.toHaveBeenCalled();
});
