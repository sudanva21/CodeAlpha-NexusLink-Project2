import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    roomId: { type: String, required: true, index: true },
    from: {
      userId: { type: String, required: true },
      username: { type: String, required: true },
      avatar: {
        color: { type: String, required: true },
        initials: { type: String, required: true },
      },
    },
    message: { type: String, required: true },
    encrypted: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

messageSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Message = mongoose.model('Message', messageSchema);
export default Message;
