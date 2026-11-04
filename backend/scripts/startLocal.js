// Local installation is deliberately bound to loopback and uses its existing SQLite data.
process.env.HOST='127.0.0.1';
process.env.PORT='3000';
process.env.DB_ENGINE='sqlite';
process.env.NODE_ENV='development';
require('../src/index');
