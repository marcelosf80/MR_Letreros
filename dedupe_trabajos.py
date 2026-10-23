#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dedupe de trabajos duplicados importados por google_sync (ids 'goog_*').
Criterio: mismo cliente (case-insensitive + trim), mismo total y misma descripción.

Uso:
  python dedupe_trabajos.py            # dry-run: solo informa
  python dedupe_trabajos.py --apply    # elimina duplicados (con backup previo)
"""
import sqlite3
import shutil
import sys
import json
import os
import datetime

DB = r'C:\MR_Letreros\datos_mr_letreros\mr_letreros.db'
TRABAJOS_JSON = r'C:\MR_Letreros\datos_mr_letreros\trabajos.json'

APPLY = '--apply' in sys.argv

# 1. Backup
stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
if APPLY:
    shutil.copy2(DB, DB + f'.bak_{stamp}')
    if os.path.exists(TRABAJOS_JSON):
        shutil.copy2(TRABAJOS_JSON, TRABAJOS_JSON + f'.bak_{stamp}')

con = sqlite3.connect(DB)
cur = con.cursor()

cur.execute("SELECT COUNT(*) FROM trabajos")
total_antes = cur.fetchone()[0]

# Duplicados exactos: mismo cliente (case/trim), total y descripcion
cur.execute("""
SELECT LOWER(TRIM(cliente_nombre)), total, descripcion, COUNT(*) c
FROM trabajos
GROUP BY LOWER(TRIM(cliente_nombre)), total, descripcion
HAVING c > 1
""")
groups = cur.fetchall()

to_delete = []
kept = []
for lower_name, total, desc, count in groups:
    cur.execute("""
    SELECT id, cliente_nombre, created_at FROM trabajos
    WHERE LOWER(TRIM(cliente_nombre)) = ? AND total = ? AND descripcion = ?
    ORDER BY created_at ASC, id ASC
    """, (lower_name, total, desc))
    rows = cur.fetchall()
    kept.append(rows[0][0])
    for r in rows[1:]:
        to_delete.append(r[0])

print(f"Total de trabajos: {total_antes}")
print(f"Grupos duplicados: {len(groups)} | Filas a eliminar: {len(to_delete)}")
for wid in to_delete:
    print("  DEL:", wid)
print("Se conservan:", kept)

if not APPLY:
    print("\n[dry-run] No se modificó nada. Ejecutar con --apply para eliminar (hace backup).")
    con.close()
    sys.exit(0)

# 2. Eliminar hijos primero (FK), luego los trabajos
for wid in to_delete:
    cur.execute("DELETE FROM trabajo_timeline WHERE trabajo_id = ?", (wid,))
    cur.execute("DELETE FROM trabajo_merger WHERE trabajo_principal_id = ?", (wid,))
    cur.execute("DELETE FROM trabajo_merger WHERE trabajo_secundario_id = ?", (wid,))
    cur.execute("DELETE FROM trabajo_pagos WHERE trabajo_id = ?", (wid,))
    cur.execute("DELETE FROM trabajos WHERE id = ?", (wid,))
con.commit()

# 3. Regenerar el backup JSON desde SQLite (camelCase, igual que GET /api/trabajos)
def jget(w, k):
    v = w.get(k)
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return v
    return v

cur.execute("SELECT * FROM trabajos ORDER BY created_at DESC")
cols = [d[0] for d in cur.description]
works = []
for row in cur.fetchall():
    w = dict(zip(cols, row))
    works.append({
        'id': w['id'], 'quoteId': w['quote_id'], 'clientId': w['cliente_id'],
        'clientName': w['cliente_nombre'], 'clientPhone': w['cliente_telefono'],
        'clientEmail': w['cliente_email'], 'clientAddress': w['cliente_address'],
        'tipo_cliente': w['tipo_cliente'], 'descripcion': w['descripcion'],
        'total': w['total'], 'totalCost': w['total_cost'], 'profit': w['profit'],
        'paidAmount': w['paid_amount'], 'balance': w['balance'], 'senia': w['senia'],
        'status': w['status'], 'paymentStatus': w['payment_status'], 'priority': w['priority'],
        'deliveryDate': w['delivery_date'], 'deliveryStatus': w['delivery_status'],
        'actualDeliveryDate': w['actual_delivery_date'], 'paidAt': w['paid_at'],
        'createdAt': w['created_at'], 'is_merged': w['is_merged'],
        'printed': w['printed'] == 1,
        'printedItems': jget(w, 'printed_items_json'),
        'completedItems': jget(w, 'completed_items_json'),
        'billedItems': jget(w, 'billed_items_json'),
        'productos': jget(w, 'productos_json'),
        'costos': jget(w, 'costos_json'),
        'notes': jget(w, 'notes_json'),
        'mergedWorks': jget(w, 'merged_works_json') or [],
    })
with open(TRABAJOS_JSON, 'w', encoding='utf-8') as fh:
    json.dump({'works': works, 'notifications': []}, fh, ensure_ascii=False, indent=2)

cur.execute("SELECT COUNT(*) FROM trabajos")
total_final = cur.fetchone()[0]
# Nota: evitar emojis/acentos en prints para no romper consolas Windows (cp1252)
print("\n[OK] Eliminados %d duplicados. Total ahora: %d" % (len(to_delete), total_final))
print("     Backup: mr_letreros.db.bak_%s" % stamp)
con.close()
