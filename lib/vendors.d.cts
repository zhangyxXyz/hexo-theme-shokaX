export type Resource = string | { source?: string; url: string; sri?: string };
export type VendorRegistry = { cdns?: Record<string, string>; [group: string]: Record<string, any> | undefined };
export type ResourceContext = { root?: string; resource?: string };
export function resolveResource(value: Resource | null | undefined, vendors?: VendorRegistry, context?: ResourceContext): string;
export function resolveVendor(vendors: VendorRegistry, name: string, fallback?: string, context?: ResourceContext): string;
