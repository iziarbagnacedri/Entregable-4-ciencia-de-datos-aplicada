# SATED · Alerta temprana de abandono escolar

Prototipo académico (ITBA · Ciencia de Datos Aplicada · Entrega 4). **No es un sistema oficial del Ministerio de Educación.**

Expone el modelo de la Entrega 3 (Random Forest que predice la tasa de abandono por zona = provincia × departamento × sector × ámbito) mediante una API REST, y una interfaz web que consume esa API.

## Cómo correrlo en local

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev          # API + interfaz en http://localhost:3000
```

Tests (incluyen la verificación de que la app da lo mismo que Python):

```bash
npx tsx --test src/ml/model.test.ts
```

## Estructura

| Carpeta | Qué hay |
|---|---|
| `src/ml/randomForestData.ts` | El modelo entrenado en la Entrega 3, exportado desde `modelo_abandono.joblib` |
| `src/ml/zonas.ts` · `zonasData.ts` | Catálogo de las 1.136 zonas reales y validación de zonas |
| `src/ml/realForest.ts` | Lógica del modelo: imputación (mediana + indicador de faltante) y los 400 árboles |
| `src/ml/schema.ts` | Variables de entrada, validación y preprocesamiento |
| `src/ml/model.ts` | Predicción de una zona o de un lote, ranking nacional y explicación por variable |
| `src/server/handlers.ts` | Capa de servicio (API): valida el pedido, llama al modelo y maneja errores |
| `api/` | Las mismas rutas como funciones de Vercel |
| `src/components/` | Interfaz web (React) |
| `scripts/exportar_modelo.py` | Regenera `randomForestData.ts` y `zonasData.ts` a partir del `.joblib` y los CSV |

## API

| Método | Ruta | Para qué |
|---|---|---|
| GET | `/api/health` | Estado del servicio y datos del modelo cargado |
| GET | `/api/model/metadata` | Variables, métricas y resultados del notebook |
| GET | `/api/zones` | Datos por provincia y zonas priorizadas |
| GET | `/api/catalogo` | Las 1.136 zonas reales (provincia, departamento, sector, ámbito) con sus datos |
| POST | `/api/predict` | Predice una zona |
| POST | `/api/predict/batch` | Predice varias zonas (`{ "rows": [...] }` o `{ "csv": "..." }`) y las ordena por riesgo |

Ejemplo:

```bash
curl -X POST http://localhost:3000/api/predict -H "Content-Type: application/json" \
  -d '{"provincia":"Formosa","departamento":"Ramón Lista","sector":"Estatal","ambito":"Rural"}'

# misma zona, simulando menos abandono el año anterior
curl -X POST http://localhost:3000/api/predict -H "Content-Type: application/json" \
  -d '{"provincia":"Formosa","departamento":"Ramón Lista","sector":"Estatal","ambito":"Rural","tasa_abandono_2022":1}'
```

**La zona tiene que existir.** Toda predicción necesita `provincia`, `departamento`, `sector` y `ambito`, y la API valida que esa combinación esté entre las 1.136 zonas reales (no distingue mayúsculas ni tildes). Si no existe, responde `400` explicando qué falla: el departamento no está en esa provincia, o esa zona no tiene esa gestión o ese ámbito (y lista las opciones).

Las variables que no se envían se completan con los **datos reales de esa zona**; las que se envían reemplazan al dato real (sirve para simular escenarios). Si la zona no tiene un dato, el modelo lo imputa con la mediana de entrenamiento, igual que el `SimpleImputer` del notebook. Si un dato es inválido (por ejemplo, texto donde va un número o una proporción mayor a 1), la API responde `400` con el detalle del error.

Salida principal: `tasaEstimadaPct` (tasa estimada en %), `altoRiesgoUmbralFijo` (si supera 1,39%, el P75 de entrenamiento), `percentilNacional` (posición frente a las predicciones de las 1.136 zonas reales) y `contribuciones` (cuánto cambia la estimación si cada variable estuviera en la mediana).

## Sobre el modelo

- Es el mismo modelo de la Entrega 3, sin reentrenar. `scripts/exportar_modelo.py` copia los árboles, umbrales y medianas del `.joblib`, y el test de paridad comprueba que, para 60 zonas reales, la app da la misma predicción que Python.
- Resultados en las 5 provincias de prueba: MAE 0,36 pp, Spearman 0,69 y recall del Top 25% de 87%.
- Limitaciones:
  - En las zonas con abandono muy alto el modelo se queda corto. Por ejemplo, para Ramón Lista estima 2,5% y la tasa real fue 7,2%. Por eso sirve más para **ordenar y priorizar** zonas que para dar el número exacto.
  - El modelo encuentra asociaciones, no causas. El simulador muestra cómo cambia la predicción, no el efecto de una política.
