import { create } from 'zustand';
import type { AgeGroup, QuestionResponse } from '@/types';

interface AssessmentState {
  assessmentId: string | null;
  ageGroup: AgeGroup | null;
  userAge: number | null;
  currentQuestion: number;
  responses: QuestionResponse[];
  startTime: number | null;
  setAgeGroup: (ag: AgeGroup) => void;
  setUserAge: (age: number) => void;
  setAssessmentId: (id: string) => void;
  addResponse: (r: QuestionResponse) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  reset: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  assessmentId: null,
  ageGroup: null,
  userAge: null,
  currentQuestion: 0,
  responses: [],
  startTime: null,
  setAgeGroup: (ageGroup) => set({ ageGroup }),
  setUserAge: (userAge) => set({ userAge }),
  setAssessmentId: (assessmentId) => set({ assessmentId, startTime: Date.now(), currentQuestion: 0, responses: [] }),
  addResponse: (r) =>
    set((state) => {
      const existing = state.responses.filter((x) => x.question_id !== r.question_id);
      return { responses: [...existing, r] };
    }),
  nextQuestion: () => set((state) => ({ currentQuestion: state.currentQuestion + 1 })),
  previousQuestion: () => set((state) => ({ currentQuestion: Math.max(0, state.currentQuestion - 1) })),
  reset: () => set({ assessmentId: null, ageGroup: null, userAge: null, currentQuestion: 0, responses: [], startTime: null }),
}));
