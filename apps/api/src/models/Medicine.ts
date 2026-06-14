import { Schema, Document, Types } from 'mongoose';

export interface IMedicine extends Document {
  _id: Types.ObjectId;
  name: string;
  content?: string;
  category?: string;
  location?: string;
  type?: 'tab' | 'cap' | 'tab_cap' | 'syrup' | 'drops' | 'cream_lotion' | 'ayurvedic' | 'dypers' | 'other';
  inStock: boolean;
  purchasePrice?: number;
  mrp?: number;
  discountedPrice?: number;
  addedFrom?: 'manual' | 'bill';
  createdAt: Date;
  updatedAt: Date;
}

export const MedicineSchema = new Schema<IMedicine>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    content: { type: String, trim: true },
    category: { type: String, trim: true },
    location: { type: String, trim: true },
    type: { type: String, enum: ['tab', 'cap', 'tab_cap', 'syrup', 'drops', 'cream_lotion', 'ayurvedic', 'dypers', 'other'] },
    inStock: { type: Boolean, default: true },
    purchasePrice: { type: Number },
    mrp: { type: Number },
    discountedPrice: { type: Number },
    addedFrom: { type: String, enum: ['manual', 'bill'], default: 'manual' },
  },
  { timestamps: true }
);

MedicineSchema.index({ name: 'text', content: 'text' });
