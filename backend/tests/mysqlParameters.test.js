jest.mock('mysql2/promise', () => ({ createConnection: jest.fn(), createPool: jest.fn() }));
const mysql = require('mysql2/promise');
const { executeMySQLQuery } = require('../src/config/mysqlAdapter');
const { translateToMySQL } = require('../src/config/mysqlAdapter');
test('MySQL preserves repeated and out-of-order parameter references', () => {
  expect(translateToMySQL('SELECT $2 AS product, $1 AS tenant WHERE $1 = $1', [42, 9]))
    .toEqual({ query: 'SELECT ? AS product, ? AS tenant WHERE ? = ?', params: [9, 42, 42, 42] });
});
test('MySQL transaction query uses its connection and returns the shared result shape', async () => {
  const connection = { query: jest.fn().mockResolvedValue([{ affectedRows: 2 }]) };
  expect(await executeMySQLQuery('UPDATE products SET name = $1 WHERE id = $2', ['A', 1], connection))
    .toMatchObject({ rowCount: 2 });
  expect(connection.query).toHaveBeenCalledWith('UPDATE products SET name = ? WHERE id = ?', ['A', 1]);
  expect(mysql.createConnection).not.toHaveBeenCalled();
});
