import { assessmentAssets } from "./assessmentAssets.ts";

type AgeGroup = "child" | "adult" | "elderly";

type ResponseShape = {
  question_id: number;
  selected_option: string;
};

type AssetQuestion = {
  id: number;
  category: string;
  featureKey: string;
  options: Array<{
    key: string;
    score: number;
    featureValue: number;
  }>;
};

const IQ_SCALE = {
  mean: 100,
  standardDeviation: 15,
  typicalMin: 70,
  typicalMax: 130,
  hardMin: 55,
  hardMax: 145,
  lowTailCorrectionThreshold: 90,
  lowTailCorrectionOffset: 10,
} as const;

function sheetKeyForAge(ageGroup: AgeGroup, age: number) {
  if (ageGroup !== "child") {
    return Object.keys(assessmentAssets.questionBanks[ageGroup].sheets)[0];
  }

  const match = assessmentAssets.questionBanks.child.sheetByAge.find((sheet) => age >= sheet.min_age && age <= sheet.max_age);
  return (match?.sheet ?? assessmentAssets.questionBanks.child.sheetByAge[assessmentAssets.questionBanks.child.sheetByAge.length - 1].sheet).replace(/[^a-zA-Z0-9]+/g, "_");
}

function getQuestions(ageGroup: AgeGroup, age: number): AssetQuestion[] {
  const bank = assessmentAssets.questionBanks[ageGroup];
  const key = sheetKeyForAge(ageGroup, age);
  return (bank.sheets as Record<string, { questions: AssetQuestion[] }>)[key]?.questions ?? [];
}

function scaleAverage(value: number | undefined, targetMin: number, targetMax: number, sourceMin: number, sourceMax: number) {
  if (value === undefined) {
    return (targetMin + targetMax) / 2;
  }

  const ratio = (value - sourceMin) / (sourceMax - sourceMin || 1);
  return targetMin + Math.min(1, Math.max(0, ratio)) * (targetMax - targetMin);
}

export function buildFeatureVector(ageGroup: AgeGroup, age: number, responses: ResponseShape[]) {
  const questionMap = new Map(getQuestions(ageGroup, age).map((question) => [question.id, question]));
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

export function predictIq(ageGroup: AgeGroup, featureVector: Record<string, number>) {
  const model = assessmentAssets.models[ageGroup];
  let total = model.intercept;

  model.featureNames.forEach((featureName, index) => {
    const rawValue = featureVector[featureName] ?? 0;
    const scaled = (rawValue - model.means[index]) / (model.scales[index] || 1);
    total += scaled * model.coefficients[index];
  });

  return total;
}

export function alignToStandardIqScale(rawIq: number) {
  if (!Number.isFinite(rawIq)) {
    return IQ_SCALE.mean;
  }

  return Math.max(IQ_SCALE.hardMin, Math.min(IQ_SCALE.hardMax, rawIq));
}

export function adjustIqPrediction(alignedIq: number) {
  const normalizedIq = alignToStandardIqScale(alignedIq);
  const needsLowTailCorrection = normalizedIq < IQ_SCALE.lowTailCorrectionThreshold;
  const correctedIq = needsLowTailCorrection
    ? normalizedIq + IQ_SCALE.lowTailCorrectionOffset
    : normalizedIq;

  return Math.round(alignToStandardIqScale(correctedIq));
}

export function computeSubScores(ageGroup: AgeGroup, age: number, responses: ResponseShape[]) {
  const questionMap = new Map(getQuestions(ageGroup, age).map((question) => [question.id, question]));
  const buckets: Record<string, number[]> = {
    verbal: [],
    logical: [],
    spatial: [],
    processing: [],
  };

  for (const response of responses) {
    const question = questionMap.get(response.question_id);
    if (!question) continue;
    const selected = question.options.find((option) => option.key === response.selected_option);
    if (!selected || !(question.category in buckets)) continue;
    buckets[question.category].push(selected.score * 100);
  }

  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

  return {
    verbal: average(buckets.verbal),
    logical: average(buckets.logical),
    spatial: average(buckets.spatial),
    processing: average(buckets.processing),
  };
}
