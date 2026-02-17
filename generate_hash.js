const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const password = 'admin';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Hash generated:', hash);
  
  const userFile = path.join(__dirname, 'datos_mr_letreros', 'usuarios.json');
  const users = [
    {
        "id": "usr_superadmin",
        "usuario": "admin",
        "password": hash,
        "rol": "superadmin",
        "nombre": "Super Administrador",
        "activo": true,
        "fechaCreacion": new Date().toISOString()
    }
  ];
  
  fs.writeFileSync(userFile, JSON.stringify(users, null, 2));
  console.log('User file updated with hash.');
});
