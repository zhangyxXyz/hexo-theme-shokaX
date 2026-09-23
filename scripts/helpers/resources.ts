import { resolveVendor } from '../../lib/vendors.cjs'

hexo.extend.helper.register('vendor_url', (name: string, fallback = '') =>
  resolveVendor(hexo.theme.config.vendors, name, fallback, { root: hexo.config.root, resource: hexo.theme.config.resource }))
