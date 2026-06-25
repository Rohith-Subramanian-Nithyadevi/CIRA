import mongoose, { Schema, Document } from 'mongoose';

export interface IGeneratedAssignment extends Document {
  student_id: string;
  original_result_id: string;
  topics_covered: string[];
  dynamic_questions_json: any; // Contains structured questions array
  pdf_url?: string;
  status: 'Pending' | 'Generated' | 'Failed';
}

const GeneratedAssignmentSchema: Schema = new Schema({
  student_id: { type: String, required: true },
  original_result_id: { type: String, required: true },
  topics_covered: { type: [String], required: true },
  dynamic_questions_json: { type: Schema.Types.Mixed, required: true },
  pdf_url: { type: String },
  status: { type: String, enum: ['Pending', 'Generated', 'Failed'], default: 'Pending' }
}, {
  timestamps: true
});

export default mongoose.model<IGeneratedAssignment>('GeneratedAssignment', GeneratedAssignmentSchema);
