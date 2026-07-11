import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    host: {
      id: { type: String, required: true },
      username: { type: String, required: true },
      avatar: {
        color: { type: String, required: true },
        initials: { type: String, required: true },
      },
    },
    participants: { type: Array, default: [] },
    files: { type: Array, default: [] },
  },
  { timestamps: true }
);

roomSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Room = mongoose.model('Room', roomSchema);
export default Room;
