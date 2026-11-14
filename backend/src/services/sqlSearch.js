'use strict';
// Arama büyük/küçük harf duyarsız olmalı. MySQL tabloları utf8mb4_bin (harf duyarlı) olduğundan orada iki taraf LOWER() ile küçültülür
// ("vida" yazınca "Vida M4"ü bulur). SQLite'ta LIKE ASCII için zaten duyarsızdır ve LOWER() yalnız ASCII küçülttüğünden
// ("Ü" aranırken "Ü" ile eşleşmeyi bozar) olduğu gibi bırakılır.
const db = require('../config/database');
const mysql = () => db.getEngine() === 'mysql';
// column LIKE expr, motora göre: ciLike('p.name', "'%' || $2 || '%'")
const ciLike = (column, expr) => (mysql() ? `LOWER(${column}) LIKE LOWER(${expr})` : `${column} LIKE ${expr}`);
module.exports = { ciLike };
