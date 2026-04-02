const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MedicineSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  brandName: {
    type: String,
    trim: true,
    default: ''
  },
  stockCount: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  oldBalance: {
    type: Number,
    default: 0
  },
  oldBalanceDate: {
    type: Date,
    default: null
  },
  oldStockExpiryDate: {
    type: Date,
    default: null
  },
  expiryDate: { 
    type: Date, 
    required: true 
  },
  batchNumber: { 
    type: String, 
    trim: true,
    default: ''
  },
  manufacturer: { 
    type: String, 
    trim: true,
    default: ''
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  reorderLevel: {
    type: Number,
    default: 20
  },
  unit: {
    type: String,
    default: 'tablets'
  },
  pricePerUnit: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

MedicineSchema.index({ expiryDate: 1 });
MedicineSchema.index({ stockCount: 1 });
MedicineSchema.index({ name: 'text', brandName: 'text' });

module.exports = mongoose.model('Medicine', MedicineSchema);