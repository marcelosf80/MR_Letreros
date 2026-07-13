const jwt = require('jsonwebtoken');
const SECRET_KEY = 'MR_LETREROS_SECURE_KEY_2024';
const token = jwt.sign(
  { id: 'usr_superadmin', usuario: 'admin', rol: 'superadmin' },
  SECRET_KEY,
  { expiresIn: '3650d' }
);
console.log('GENERATED_TOKEN:', token);
