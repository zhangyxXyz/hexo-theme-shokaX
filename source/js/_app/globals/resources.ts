import { resolveVendor } from '../../../../lib/vendors.cjs'
import { CONFIG } from './globalVars'

/** Resolve only: callers retain ownership of when/how a resource is loaded. */
export const resourceURL = (name: string, fallback = ''): string =>
  resolveVendor(CONFIG.vendors, name, fallback, { root: CONFIG.root, resource: CONFIG.resource })
