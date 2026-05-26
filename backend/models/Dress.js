const mongoose = require('mongoose')
const { Schema } = mongoose

const DressSchema = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, default: 0, min: 0 },
  discountPrice: { type: Number, default: 0, min: 0 },
  images: [{ type: String }],
  category: { 
    type: String, 
    enum: ['زفاف', 'سهرة', 'خطوبة', 'fony', 'home'], 
    default: 'زفاف' 
  },
  colors: [{ 
    name: String,
    hex: String,
    image: String
  }],
  sizes: [{
    size: { type: String, enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    stock: { type: Number, default: 0, min: 0 },
    priceAdjust: { type: Number, default: 0 }
  }],
  material: { type: String, trim: true },
  inStock: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  isNewDress: { type: Boolean, default: false },
  isOnSale: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true })

DressSchema.index({ name: 'text', description: 'text' })
DressSchema.index({ category: 1 })
DressSchema.index({ price: 1 })
DressSchema.index({ featured: 1 })
DressSchema.index({ createdAt: -1 })

// Virtual for backward compatibility
DressSchema.virtual('isNew').get(function() { return this.isNewDress })
DressSchema.set('toJSON', { virtuals: true })
DressSchema.set('toObject', { virtuals: true })

module.exports = mongoose.model('Dress', DressSchema)
