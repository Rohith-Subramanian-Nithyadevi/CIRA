import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestionBank extends Document {
  question_type: string;
  topic: string;
  sub_topics: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  content: string;
  options: string[];
  correct_option: string;
  metadata_tags: string[];
}

const QuestionBankSchema: Schema = new Schema({
  question_type: { type: String, required: true },
  topic: { type: String, required: true },
  sub_topics: { type: [String], required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  content: { type: String, required: true },
  options: { type: [String], required: true },
  correct_option: { type: String, required: true },
  metadata_tags: { type: [String], default: [] },
}, {
  timestamps: true
});

export default mongoose.model<IQuestionBank>('QuestionBank', QuestionBankSchema);
