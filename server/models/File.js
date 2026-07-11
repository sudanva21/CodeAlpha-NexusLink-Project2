import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    mimetype: { type: String, required: true },
    uploadedBy: {
      id: { type: String, required: true },
      username: { type: String, required: true },
    },
    roomId: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

fileSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const File = mongoose.model('File', fileSchema);
export default File;
