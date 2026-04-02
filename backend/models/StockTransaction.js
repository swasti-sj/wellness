const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StockTransactionSchema = new Schema({
  medicine: {
    type: Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  transactionType: {
    type: String,
    enum: ['ADDITION', 'ADJUSTMENT', 'RETURN', 'OPENING_BALANCE', 'EXPIRY_REMOVAL'],
    required: true
  },
  quantityChanged: {
    type: Number,
    required: true
  },
  stockBefore: {
    type: Number,
    required: true
  },
  stockAfter: {
    type: Number,
    required: true
  },
  batchNumber: {
    type: String,
    trim: true,
    default: ''
  },
  newExpiryDate: {
    type: Date,
    default: null
  },
  manufacturer: {
    type: String,
    trim: true,
    default: ''
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Pharmacist'
  },
  receivedDate: {
    type: Date,
    default: Date.now
  },
  supplier: {
    type: String,
    trim: true,
    default: ''
  },
  invoiceNumber: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

StockTransactionSchema.index({ medicine: 1, createdAt: -1 });
StockTransactionSchema.index({ transactionType: 1, createdAt: -1 });
StockTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('StockTransaction', StockTransactionSchema);