import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    socketId: { type: String, required: true },
    username: { type: String, required: true },
    joinTime: { type: Date, default: Date.now },
    leaveTime: { type: Date, default: null },
    role: { type: String, enum: ['Host', 'Participant'], default: 'Participant' },
  },
  { timestamps: true }
);

participantSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Participant = mongoose.model('Participant', participantSchema);
export default Participant;
