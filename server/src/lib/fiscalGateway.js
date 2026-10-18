import { InventoryError } from './inventoryService.js'

/**
 * Contrato para un adaptador real de PSE/OSE. No hay proveedor implementado.
 * adapter.issue({ sale, document, idempotencyKey }) y adapter.lookup(externalId)
 * deben devolver { provider, externalId, status, responseId, receivedAt, cdrUrl? }.
 * El adaptador debe verificar origen/firma, guardar respuesta auténtica y
 * resolver timeouts con lookup antes de reemitir. Nunca acepta un estado local.
 */
export function createFiscalGateway(adapter = null) {
  const validate = response => {
    if (!response?.provider || !response.externalId || !response.responseId || !response.receivedAt
      || !['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(response.status)) {
      throw new InventoryError(502, 'El proveedor fiscal no devolvió una respuesta verificable.')
    }
    return response
  }
  const required = () => {
    if (!adapter?.issue || !adapter?.lookup) throw new InventoryError(503, 'Emisión fiscal no configurada. Usa el ticket interno y el procedimiento fiscal vigente del negocio.')
    return adapter
  }
  return {
    status: () => ({ enabled: Boolean(adapter), provider: adapter?.name ?? null, status: adapter ? 'ADAPTER_CONFIGURED' : 'NOT_CONFIGURED',
      missing: adapter ? [] : ['Proveedor y contrato API', 'RUC y datos fiscales', 'Series y correlativos', 'Credenciales sandbox/producción', 'Certificado o delegación de firma según proveedor', 'Homologación y validación de respuestas/CDR'] }),
    issue: async request => validate(await required().issue(request)),
    lookup: async externalId => validate(await required().lookup(externalId)),
  }
}
export const fiscalGateway = createFiscalGateway()
