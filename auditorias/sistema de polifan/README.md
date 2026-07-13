# nesting_engine

Auto-posicionamiento (nesting) de piezas irregulares sobre una plancha de
ancho fijo, minimizando el largo de material usado. Mismo problema que
resuelve la macro del video (NFP + optimización de orden/rotación), pero
open-source y embebible en un backend Python.

## Arquitectura

```
geometry.py    -> Piece, rotación, bounding box (sin dependencias externas)
nfp.py         -> No-Fit-Polygon (colisión pieza-pieza) e Inner-Fit-Polygon
                   (pieza-contenedor), vía Minkowski sum (pyclipper)
placement.py   -> Bottom-left-fill: coloca una secuencia fija de piezas
genetic.py     -> Busca la secuencia + rotaciones que minimizan largo usado
api.py         -> Router FastAPI (POST /nest)
tests/         -> 8 unit tests, incluyen chequeo de overlap con Shapely
                   (librería independiente del propio motor, para no
                   "validar con la misma regla que generó el resultado")
```

## Por qué este enfoque (vs. alternativas)

| Opción | Pros | Contras |
|---|---|---|
| **NFP propio (pyclipper) + GA** *(elegido)* | Sin dependencias de infraestructura extra, corre in-process en FastAPI, control total | Hubo que resolver a mano un bug real de NFP en piezas cóncavas (ver abajo) |
| Envolver SVGNest/deepnest (Node) | Motor maduro, probado en miles de casos, soporta nesting en concavidades | Requiere correr un proceso Node separado, IPC extra, otro runtime que mantener |
| `rectpack` u otras libs de bin-packing | Simple, rápida | Solo rectángulos — no sirve para letras/logos |

Para un negocio chico con backend Python ya armado (SignageMockup Pro), evitar
un segundo runtime (Node) pesa más que la sofisticación adicional de SVGNest.
Si más adelante el volumen de piezas justifica exprimir cada % de material,
migrar a SVGNest vía microservicio es la ruta natural.

## Trade-off explícito: piezas cóncavas y "bolsillos"

El NFP real entre dos piezas cóncavas puede incluir un lóbulo secundario que
representa una zona *segura* dentro de la concavidad de la otra pieza (por
ejemplo, anidar una pieza chica dentro del hueco de una "L"). Al combinar ese
lóbulo con el offset de espaciado (spacing entre piezas), un offset con
esquinas mitre en vértices reflexivos puede autointersectarse y corromper el
sentido de giro del lóbulo — eso generó un overlap real detectado por los
tests (`test_optimize_end_to_end_places_all_pieces_without_overlap`).

**Decisión tomada:** `outer_nfp` descarta los lóbulos secundarios y usa solo
el contorno dominante. Se pierde la posibilidad de anidar piezas dentro de
concavidades ajenas (utilización algo menor en formas muy cóncavas, tipo
letras "C", "U"), pero se garantiza cero overlaps, que es la prioridad para
no desperdiciar plancha por un corte mal calculado.

## Otro trade-off: huecos internos (letras "O", "A", "D")

v1 nestea usando solo el contorno exterior de cada pieza — no aprovecha el
hueco interior de una letra para meter otra pieza chica adentro. Es una
optimización real (así lo hacen los nesting engines "pro"), pero agrega
bastante complejidad (NFP piezas-en-hueco) para un beneficio que depende
mucho del tipo de piezas que cortés. Si en la práctica cortás muchas letras
con huecos grandes (O, D, Q) y piezas chicas que entrarían ahí, avisame y lo
sumamos como v2.

## Integración con SignageMockup Pro

`api.py` no sabe de dónde vienen los contornos — eso ya lo resuelve tu
pipeline de VTracer/Real-ESRGAN (vectorización). En el endpoint que llama al
nesting, extraé el contorno vectorizado de cada pieza (lista de puntos
[x,y] en mm) y armá el `PieceIn` correspondiente.

```python
from nesting_engine.api import nesting_router
app.include_router(nesting_router, prefix="/api/nesting")
```

```bash
curl -X POST localhost:8000/api/nesting/nest -H "Content-Type: application/json" -d '{
  "sheet_width_mm": 1350,
  "spacing_mm": 3,
  "pieces": [
    {"id": "letra_A", "contour": [[0,0],[40,0],[40,60],[0,60]], "quantity": 5,
     "allowed_rotations": [0, 90, 180, 270]}
  ]
}'
```

## Testing

```bash
pip install pyclipper shapely numpy pytest fastapi pydantic --break-system-packages
python3 -m pytest nesting_engine/tests/ -v
```

Los tests de overlap usan **Shapely** para verificar geometría, deliberadamente
independiente de pyclipper (el motor), para no validar el resultado con la
misma librería/lógica que lo produjo.

## Parámetros de calidad (equivalente a "FAST" del macro del video)

`population_size` y `generations` controlan el trade-off tiempo/calidad del
GA. Sugerido para empezar:

- Preview rápido en UI: `population_size=15, generations=15` (~1-2s para
  ~20 piezas)
- Corte final: `population_size=30, generations=60` (mejor empaquetado,
  más tiempo — correlo en background/async, no bloqueando el request)

## Limitaciones conocidas / próximos pasos

1. Sin soporte de nesting-en-hueco (ver arriba).
2. `place_on_sheet` es O(n²) en NFPs calculados por pieza colocada (recalcula
   contra todas las piezas ya puestas) — para lotes de +200 piezas conviene
   indexar espacialmente (ej. filtrar por bounding-box antes de calcular NFP
   exacto) antes de escalar el volumen de piezas por corrida.
3. Sheets de ancho fijo únicamente (no maneja layout multi-sheet automático
   cuando el largo total supera el rollo disponible — hoy retorna
   `unplaced_piece_ids` si no entra, hay que decidir política de "iniciar
   sheet nueva").
