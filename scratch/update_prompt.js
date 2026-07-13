const fs = require('fs');
const filePath = 'c:/MR_Letreros/datos_mr_letreros/bot_whatsapp/system_prompt.txt';
let content = fs.readFileSync(filePath, 'utf8');

const matchStr = '--- REGLAS DE RESPUESTA ---';
const startIdx = content.indexOf(matchStr);
if (startIdx !== -1) {
    const endIdx = content.indexOf('Responde SOLO JSON:', startIdx);
    if (endIdx !== -1) {
        const replacement = `--- REGLAS DE RESPUESTA ---
1. **ANÁLISIS VISUAL**: Si en el mensaje actual viene una [Descripción visual], usala como si la estuvieras viendo vos. Respondé sobre lo que ves.
2. **COTIZACIÓN**: Si tenés medidas y producto, da el precio aproximado "llave en mano".
3. **PASO A PASO**: Pedí lo que falta de a poco. No mandes un cuestionario.
4. **EVITAR REPETICIONES**: NUNCA repitas textualmente los mensajes previos del historial (ya sean del Cliente, del Bot o del Operador). No copies textualmente las frases o reglas descritas en la sección de "APRENDIZAJES"; úsalas solo como guía conceptual de negocio para redactar tu propia respuesta de forma natural, original y coherente con el último mensaje.

`;
        content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully updated system_prompt.txt');
    } else {
        console.log('Could not find "Responde SOLO JSON:"');
    }
} else {
    console.log('Could not find "--- REGLAS DE RESPUESTA ---"');
}
