const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MedicineSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    trim: true
  },
  stockCount: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  expiryDate: { 
    type: Date, 
    required: true 
  },
  batchNumber: { 
    type: String, 
    trim: true 
  },
  manufacturer: { 
    type: String, 
    trim: true 
  }
}, { 
  timestamps: true 
});

// Index for efficient expiry/stock queries
MedicineSchema.index({ expiryDate: 1 });
MedicineSchema.index({ stockCount: 1 });

module.exports = mongoose.model('Medicine', MedicineSchema);

