import { HydratedDocument, Schema, model } from 'mongoose'
import { PrinterSettings, hexColorRegex } from '../../common/types.js'
import { reportPrinter } from '../factory.js'

export const printerSettingsSchema = () =>
  new Schema<PrinterSettings>({
    pageSize: {
      type: { width: { type: Number, min: 0, required: true }, height: { type: Number, min: 0, required: true } },
      required: true,
      description: 'in PDF-Units (72 PDF-Units ≙ 1 inch)'
    },
    fontSizes: {
      type: {
        S: { type: Number, min: 1, required: true, label: 'S' },
        M: { type: Number, min: 1, required: true, label: 'M' },
        L: { type: Number, min: 1, required: true, label: 'L' }
      },
      required: true
    },
    pagePadding: { type: Number, min: 0, required: true },
    cellPadding: {
      type: { x: { type: Number, min: 0, required: true, label: 'X' }, bottom: { type: Number, min: 0, required: true } },
      required: true
    },
    textColor: { type: String, required: true, validate: hexColorRegex },
    borderColor: { type: String, required: true, validate: hexColorRegex },
    borderThickness: { type: Number, min: 0, required: true }
  })

const schema = printerSettingsSchema()

schema.post('save', function (this: HydratedDocument<PrinterSettings>) {
  reportPrinter.setSettings(this)
})

export default model('PrinterSettings', schema)
