import { assessmentAssets } from "@/lib/assessmentAssets";
import type { AgeGroup, QuestionResponse } from "@/types";

type AssetQuestion = {
  id: number;
  questionNumber: number;
  sheetKey: string;
  ageGroup: AgeGroup;
  phase: "cognitive" | "profile";
  category: string;
  questionText: string;
  featureKey: string;
  options: Array<{
    key: string;
    text: string;
    score: number;
    featureValue: number;
  }>;
};

export type AssessmentQuestion = {
  id: number;
  age_group: AgeGroup;
  category: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  difficulty: number;
  weight: number;
  phase: "cognitive" | "profile";
  options: AssetQuestion["options"];
  feature_key: string;
};

const CHILD_SHEETS = assessmentAssets.questionBanks.child.sheetByAge;

function getSheetKeyForAge(ageGroup: AgeGroup, age: number) {
  if (ageGroup !== "child") {
    const bank = assessmentAssets.questionBanks[ageGroup];
    return Object.keys(bank.sheets)[0];
  }

  const match = CHILD_SHEETS.find((sheet) => age >= sheet.min_age && age <= sheet.max_age);
  return (match?.sheet ?? CHILD_SHEETS[CHILD_SHEETS.length - 1].sheet).replace(/[^a-zA-Z0-9]+/g, "_");
}

function getAssetQuestions(ageGroup: AgeGroup, age: number): AssetQuestion[] {
  const bank = assessmentAssets.questionBanks[ageGroup];
  const sheetKey = getSheetKeyForAge(ageGroup, age);
  return (bank.sheets as Record<string, { questions: AssetQuestion[] }>)[sheetKey]?.questions ?? [];
}

export function getQuestionsForAssessment(ageGroup: AgeGroup, age: number): AssessmentQuestion[] {
  return getAssetQuestions(ageGroup, age).map((question) => ({
    id: question.id,
    age_group: ageGroup,
    category: question.category,
    question_text: question.questionText,
    option_a: question.options[0]?.text ?? "",
    option_b: question.options[1]?.text ?? "",
    option_c: question.options[2]?.text ?? "",
    option_d: question.options[3]?.text ?? "",
    correct_option: question.options.find((option) => option.score === 1)?.key ?? "",
    difficulty: question.phase === "cognitive" ? 1 : 2,
    weight: question.phase === "cognitive" ? 1.2 : 1,
    phase: question.phase,
    options: question.options,
    feature_key: question.featureKey,
  }));
}

export function getQuestionById(ageGroup: AgeGroup, age: number, questionId: number) {
  return getQuestionsForAssessment(ageGroup, age).find((question) => question.id === questionId) ?? null;
}

export function buildFeatureVector(ageGroup: AgeGroup, age: number, responses: QuestionResponse[]) {
  const questionMap = new Map(getAssetQuestions(ageGroup, age).map((question) => [question.id, question]));
  const buckets: Record<string, number[]> = {};

  for (const response of responses) {
    const question = questionMap.get(response.question_id);
    if (!question) continue;

    const selected = question.options.find((option) => option.key === response.selected_option);
    if (!selected) continue;

    buckets[question.featureKey] ??= [];
    buckets[question.featureKey].push(selected.featureValue);
  }

  const average = (key: string) => {
    const values = buckets[key] ?? [];
    if (values.length === 0) return undefined;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  if (ageGroup === "adult") {
    return {
      age,
      sleep_duration: average("sleep_duration") ?? 6.5,
      stress_level: average("stress_level") ?? 5,
      daily_screen_time: average("daily_screen_time") ?? 4,
      exercise_frequency: average("exercise_frequency") ?? 2,
      caffeine_intake: average("caffeine_intake") ?? 125,
      reaction_time: average("reaction_time") ?? 450,
      memory_test_score: average("memory_test_score") ?? 60,
      reasoning_index: scaleAverage(average("reasoning_index"), 25, 95, 1, 4),
    };
  }

  if (ageGroup === "elderly") {
    return {
      age,
      sleep_quality_score: average("sleep_quality_score") ?? 3.5,
      physical_activity_score: average("physical_activity_score") ?? 4.5,
      gds_score: average("gds_score") ?? 5,
      memory_index: scaleAverage(average("memory_index"), 10, 29, 1, 4),
    };
  }

  return {
    age_years: age,
    educ_cat: average("educ_cat") ?? 2,
    development_index: average("development_index") ?? 2.5,
  };
}

function scaleAverage(value: number | undefined, targetMin: number, targetMax: number, sourceMin: number, sourceMax: number) {
  if (value === undefined) {
    return (targetMin + targetMax) / 2;
  }

  const ratio = (value - sourceMin) / (sourceMax - sourceMin || 1);
  return targetMin + Math.min(1, Math.max(0, ratio)) * (targetMax - targetMin);
}

export function scoreResponse(question: AssessmentQuestion, optionKey: string) {
  return question.options.find((option) => option.key === optionKey)?.score ?? 0;
}

export { assessmentAssets };
