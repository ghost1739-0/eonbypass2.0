import { ProductDocument } from '../database/models/Product';

export function getProductTitle(product: ProductDocument): string {
  return (product.title ?? 'Untitled product').toString();
}

export function getProductDescription(product: ProductDocument): string {
  return (product.description ?? 'No description provided.').toString();
}

export function getProductPrice(product: ProductDocument): string {
  return (product.price ?? 'N/A').toString();
}

export function getProductSummary(product: ProductDocument): string {
  return `${getProductPrice(product)} — ${getProductDescription(product)}`.slice(0, 100);
}
