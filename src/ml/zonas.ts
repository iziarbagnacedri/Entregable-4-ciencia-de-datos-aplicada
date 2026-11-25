/**
 * Catálogo de las 1.136 zonas reales (provincia × departamento × sector × ámbito) del ciclo 2023,
 * con sus 20 variables, su tasa real y la que estima el modelo. Sirve para:
 *  - validar que una zona exista en esa provincia antes de predecir,
 *  - completar los datos de una zona real cuando el usuario la elige.
 */
import data from './zonasData.ts';
import { FEATURE_KEYS, type FeatureKey } from './schema.ts';

export interface ZonaReal {
  id: string;
  provincia: string;
  departamento: string;
  sector: 'Estatal' | 'Privado';
  ambito: 'Urbano' | 'Rural';
  matricula: number;
  tasaRealPct: number;
  tasaModeloPct: number;
  variables: Partial<Record<FeatureKey, number>>;
}

type Fila = [string, string, 'Estatal' | 'Privado', 'Urbano' | 'Rural', number, number, number, Array<number | null>];
const RAW = data as { variables: string[]; filas: Fila[] };

/** Mayúsculas y sin tildes, para comparar "Orán" con "ORAN" o "Entre Ríos" con "entre rios". */
export function normalizar(txt: string): string {
  return String(txt ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const ZONAS: ZonaReal[] = RAW.filas.map(([provincia, departamento, sector, ambito, matricula, tasaReal, tasaModelo, vals]) => {
  const variables: Partial<Record<FeatureKey, number>> = {};
  RAW.variables.forEach((k, i) => {
    const v = vals[i];
    if (v !== null && FEATURE_KEYS.includes(k as FeatureKey)) variables[k as FeatureKey] = v;
  });
  return {
    id: `${normalizar(provincia)}|${normalizar(departamento)}|${normalizar(sector)}|${normalizar(ambito)}`,
    provincia,
    departamento,
    sector,
    ambito,
    matricula,
    tasaRealPct: tasaReal,
    tasaModeloPct: tasaModelo,
    variables,
  };
});

export const PROVINCIAS: string[] = [...new Set(ZONAS.map((z) => z.provincia))].sort((a, b) => a.localeCompare(b, 'es'));

const POR_ID = new Map(ZONAS.map((z) => [z.id, z]));

export function departamentosDe(provincia: string): string[] {
  const p = normalizar(provincia);
  return [...new Set(ZONAS.filter((z) => normalizar(z.provincia) === p).map((z) => z.departamento))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

export function zonasDe(provincia: string, departamento: string): ZonaReal[] {
  const p = normalizar(provincia);
  const d = normalizar(departamento);
  return ZONAS.filter((z) => normalizar(z.provincia) === p && normalizar(z.departamento) === d);
}

export function buscarZona(provincia: string, departamento: string, sector: string, ambito: string): ZonaReal | undefined {
  return POR_ID.get(`${normalizar(provincia)}|${normalizar(departamento)}|${normalizar(sector)}|${normalizar(ambito)}`);
}

export type ValidacionZona = { ok: true; zona: ZonaReal } | { ok: false; error: string };

/**
 * Valida que la zona exista. Devuelve un mensaje claro según qué parte falla:
 * la provincia, el departamento dentro de esa provincia, o la combinación de gestión y ámbito.
 */
export function validarZona(provincia: unknown, departamento: unknown, sector: unknown, ambito: unknown): ValidacionZona {
  if (typeof provincia !== 'string' || !provincia.trim()) {
    return { ok: false, error: 'Falta la provincia de la zona.' };
  }
  if (typeof departamento !== 'string' || !departamento.trim()) {
    return { ok: false, error: 'Falta el departamento de la zona.' };
  }
  if (!PROVINCIAS.some((p) => normalizar(p) === normalizar(provincia))) {
    return { ok: false, error: `La provincia "${provincia}" no existe en los datos.` };
  }
  const candidatas = zonasDe(provincia, departamento);
  if (candidatas.length === 0) {
    return { ok: false, error: `El departamento "${departamento}" no existe en la provincia de ${provincia}.` };
  }
  const sec = typeof sector === 'string' ? sector : '';
  const amb = typeof ambito === 'string' ? ambito : '';
  const zona = candidatas.find((z) => normalizar(z.sector) === normalizar(sec) && normalizar(z.ambito) === normalizar(amb));
  if (!zona) {
    const opciones = candidatas.map((z) => `${z.sector} ${z.ambito.toLowerCase()}`).join(', ');
    return {
      ok: false,
      error: `En ${candidatas[0].departamento} (${candidatas[0].provincia}) no hay zona ${sec || '¿gestión?'} ${(amb || '¿ámbito?').toLowerCase()}. Opciones: ${opciones}.`,
    };
  }
  return { ok: true, zona };
}
