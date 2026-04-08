export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  age_group: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Assessment {
  id: string;
  user_id: string;
  age_group: 'child' | 'adult' | 'elderly';
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at: string | null;
  time_taken_seconds: number | null;
}

export interface Question {
  id: number;
  age_group: 'child' | 'adult' | 'elderly';
  category: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  difficulty: number;
  weight: number;
  phase?: 'cognitive' | 'profile';
  feature_key?: string;
  options?: Array<{
    key: string;
    text: string;
    score: number;
    featureValue: number;
  }>;
}

export interface QuestionResponse {
  question_id: number;
  answer_value: number;
  selected_option: string;
  response_time_ms: number;
}

export interface Prediction {
  id: string;
  assessment_id: string;
  user_id: string | null;
  age_group: string;
  predicted_iq: number;
  percentile: number | null;
  verbal_score: number | null;
  logical_score: number | null;
  spatial_score: number | null;
  processing_speed_score: number | null;
  confidence_score: number | null;
  model_version: string | null;
  created_at: string;
}

export type AgeGroup = 'child' | 'adult' | 'elderly';
export type QuestionCategory = 'verbal' | 'logical' | 'spatial' | 'processing';
