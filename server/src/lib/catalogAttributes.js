import { FILTER_SPEC_LABELS } from '../../../src/utils/catalogFilters.js'

// Project only supported short specifications inside PostgreSQL. Large technical
// sheets never travel from Neon just to build the list's filters. JSON parameters
// keep identifiers/labels separate from SQL and support an empty result safely.
export async function attachCatalogAttributes(db, products) {
  if (!products.length) return products
  const ids = JSON.stringify(products.map((product) => product.id))
  const labels = JSON.stringify(FILTER_SPEC_LABELS)
  const rows = await db.$queryRaw`
    SELECT p.id, jsonb_agg(jsonb_build_object(
      'label', left(spec.value->>'label', 80), 'value', spec.value->>'value'
    ) ORDER BY spec.ordinality) AS specifications
    FROM products p
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.specifications) = 'array' THEN p.specifications ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS spec(value, ordinality)
    WHERE p.id IN (SELECT jsonb_array_elements_text(${ids}::jsonb))
      AND translate(lower(regexp_replace(trim(spec.value->>'label'), '\\s+', ' ', 'g')),
        'áéíóúüñ', 'aeiouun') IN (SELECT jsonb_array_elements_text(${labels}::jsonb))
      AND jsonb_typeof(spec.value->'value') = 'string'
      AND length(trim(spec.value->>'value')) BETWEEN 1 AND 60
    GROUP BY p.id
  `
  const byId = new Map(rows.map((row) => [row.id, row.specifications]))
  return products.map((product) => ({ ...product, specifications: byId.get(product.id) || [] }))
}
