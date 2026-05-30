import { Schema, model, Document } from 'mongoose';
import { IProduct } from '../../types';

export interface ProductDocument extends Omit<IProduct, '_id'>, Document {}

const productSchema = new Schema<ProductDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    price: { type: String, required: true, trim: true, maxlength: 50 },
    createdBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

productSchema.index({ title: 1 });

export const ProductModel = model<ProductDocument>('Product', productSchema);
