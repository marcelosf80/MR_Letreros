const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const saltRounds = 10;
const usersData = [
    { user: 'admin', pass: 'admin', role: 'superadmin', name: 'Super Admin' },
    { user: 'gerente', pass: 'gerente123', role: 'admin', name: 'Gerente General' },
    { user: 'vendedor', pass: 'vendedor123', role: 'vendedor', name: 'Vendedor Principal' },
    { user: 'taller', pass: 'taller123', role: 'produccion', name: 'Jefe de Taller' },
    { user: 'auditor', pass: 'auditor123', role: 'visor', name: 'Auditor Externo' }
];

async function createUsers() {
    const users = [];
    for (const u of usersData) {
        const hash = await bcrypt.hash(u.pass, saltRounds);
        users.push({
            id: `usr_${u.role}`,
            usuario: u.user,
            password: hash,
            rol: u.role,
            nombre: u.name,
            activo: true,
            fechaCreacion: new Date().toISOString()
        });
        console.log(`Created user: ${u.user} (${u.role})`);
    }

    const userFile = path.join(__dirname, 'datos_mr_letreros', 'usuarios.json');
    fs.writeFileSync(userFile, JSON.stringify(users, null, 2));
    console.log('All users created successfully in usuarios.json');
}

createUsers();
