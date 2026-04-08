import json
from pathlib import Path

import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_DIR = ROOT / "questions"
DATA_DIR = ROOT / "data"
FRONTEND_OUTPUT = ROOT / "src" / "lib" / "assessmentAssets.ts"
EDGE_OUTPUT = ROOT / "supabase" / "functions" / "submit-assessment" / "assessmentAssets.ts"


AGE_GROUP_CONFIG = {
    "child": {
        "workbook": QUESTIONS_DIR / "Child_Question.xlsx",
        "sheet_by_age": [
            {"min_age": 0, "max_age": 2, "sheet": "0-2"},
            {"min_age": 3, "max_age": 5, "sheet": "3-5"},
            {"min_age": 6, "max_age": 10, "sheet": "6-10"},
            {"min_age": 11, "max_age": 17, "sheet": "11-17"},
        ],
        "question_offset": 1000,
        "cognitive_numbers": list(range(1, 11)),
        "feature_groups": {
            "development_index": list(range(1, 11)),
            "educ_cat": list(range(11, 26)),
        },
        "categories": {
            "verbal": [1, 3, 6, 11, 14, 17],
            "logical": [4, 5, 15, 20, 22, 23],
            "spatial": [2, 7, 8, 16, 18, 25],
            "processing": [9, 10, 12, 13, 19, 21, 24],
        },
    },
    "adult": {
        "workbook": QUESTIONS_DIR / "Adult_Question.xlsx",
        "sheet": "Adult Question Bank",
        "question_offset": 2000,
        "cognitive_numbers": [6, 7, 9, 10, 11, 12, 13, 14, 16, 17],
        "feature_map": {
            1: "sleep_duration",
            2: "stress_level",
            3: "daily_screen_time",
            4: "exercise_frequency",
            5: "caffeine_intake",
            6: "memory_test_score",
            7: "reaction_time",
            8: "exercise_frequency",
            9: "memory_test_score",
            10: "memory_test_score",
            11: "stress_level",
            12: "memory_test_score",
            13: "memory_test_score",
            14: "memory_test_score",
            15: "stress_level",
            16: "reasoning_index",
            17: "reasoning_index",
            18: "reasoning_index",
            19: "reasoning_index",
            20: "reasoning_index",
            21: "reasoning_index",
            22: "reasoning_index",
            23: "reasoning_index",
            24: "reasoning_index",
            25: "reasoning_index",
        },
        "categories": {
            "verbal": [6, 12, 13, 18],
            "logical": [14, 16, 17, 19, 20, 21, 22, 23, 24, 25],
            "spatial": [8],
            "processing": [1, 2, 3, 4, 5, 7, 9, 10, 11, 15],
        },
    },
    "elderly": {
        "workbook": QUESTIONS_DIR / "OldAge_Question.xlsx",
        "sheet": "Old Age Question Bank",
        "question_offset": 3000,
        "cognitive_numbers": [3, 4, 5, 6, 9, 10, 13, 14, 15, 16],
        "feature_map": {
            1: "sleep_quality_score",
            2: "sleep_quality_score",
            3: "gds_score",
            4: "memory_index",
            5: "gds_score",
            6: "memory_index",
            7: "physical_activity_score",
            8: "physical_activity_score",
            9: "gds_score",
            10: "memory_index",
            11: "memory_index",
            12: "gds_score",
            13: "memory_index",
            14: "gds_score",
            15: "memory_index",
            16: "memory_index",
            17: "memory_index",
            18: "memory_index",
            19: "memory_index",
            20: "memory_index",
            21: "memory_index",
            22: "memory_index",
            23: "memory_index",
            24: "memory_index",
            25: "memory_index",
        },
        "categories": {
            "verbal": [4, 11, 12, 13, 15, 25],
            "logical": [16, 17, 18, 19, 20, 21, 22, 23, 24],
            "spatial": [6, 10],
            "processing": [1, 2, 3, 5, 7, 8, 9, 14],
        },
    },
}


ADULT_CORRECT_OPTIONS = {
    16: "C",
    17: "C",
    18: "C",
    19: "B",
    20: "B",
    21: "D",
    22: "B",
    23: "B",
    24: "B",
    25: "D",
}

ELDERLY_CORRECT_OPTIONS = {
    16: "C",
    17: "B",
    18: "D",
    19: "A",
    20: "C",
    21: "C",
    22: "C",
    23: "C",
    24: "D",
    25: "C",
}


ADULT_OPTION_VALUES = {
    1: [3.5, 5.0, 7.0, 8.5],
    2: [1.0, 3.0, 6.0, 9.0],
    3: [1.5, 3.0, 5.0, 8.0],
    4: [3.0, 1.0],
    5: [0.0, 50.0, 150.0, 250.0],
    6: [35.0, 55.0, 75.0, 92.0],
    7: [650.0, 500.0, 350.0, 260.0],
    8: [4.0, 1.0],
    9: [92.0, 78.0, 58.0, 38.0],
    10: [35.0, 55.0, 75.0, 92.0],
    11: [1.0, 3.0, 6.0, 9.0],
    12: [35.0, 55.0, 72.0, 88.0],
    13: [30.0, 50.0, 68.0, 85.0],
    14: [35.0, 55.0, 75.0, 92.0],
    15: [1.0, 3.0, 6.0, 9.0],
}

ELDERLY_OPTION_VALUES = {
    1: [1.5, 2.8, 4.0, 5.0],
    2: [5.0, 2.0],
    3: [1.0, 4.0, 8.0, 12.0],
    4: [12.0, 18.0, 24.0, 29.0],
    5: [1.0, 4.0, 8.0, 12.0],
    6: [10.0, 18.0, 28.0],
    7: [7.0, 2.0],
    8: [2.0, 5.0, 8.0],
    9: [10.0, 7.0, 4.0, 1.0],
    10: [14.0, 22.0, 29.0],
    11: [27.0, 14.0],
    12: [8.0, 5.0, 2.0],
    13: [28.0, 16.0],
    14: [1.0, 4.0, 8.0, 12.0],
    15: [12.0, 20.0, 28.0],
}


def sheet_key(value: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in value).strip("_")


def clean_cell(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def normalized_score(index: int, total: int, reverse: bool = False) -> float:
    if total <= 1:
        return 1.0
    ratio = index / (total - 1)
    return round(1 - ratio if reverse else ratio, 4)


def infer_category(age_group: str, question_number: int) -> str:
    for category, numbers in AGE_GROUP_CONFIG[age_group]["categories"].items():
        if question_number in numbers:
            return category
    return "processing"


def build_child_question_bank() -> dict:
    config = AGE_GROUP_CONFIG["child"]
    workbook = pd.ExcelFile(config["workbook"])
    sheets = {}

    for sheet_index, range_config in enumerate(config["sheet_by_age"]):
        frame = workbook.parse(range_config["sheet"])
        questions = []
        for _, row in frame.iterrows():
            question_number = int(row["Q.No"])
            options = []
            raw_options = [row["Option A"], row["Option B"], row["Option C"], row["Option D"]]
            non_empty = [clean_cell(option) for option in raw_options if clean_cell(option)]
            for option_index, option_text in enumerate(non_empty):
                options.append(
                    {
                        "key": chr(65 + option_index),
                        "text": option_text,
                        "score": normalized_score(option_index, len(non_empty)),
                        "featureValue": round(1 + normalized_score(option_index, len(non_empty)) * 3, 4),
                    }
                )

            feature_key = "development_index" if question_number in config["feature_groups"]["development_index"] else "educ_cat"
            questions.append(
                {
                    "id": config["question_offset"] + sheet_index * 100 + question_number,
                    "questionNumber": question_number,
                    "sheetKey": sheet_key(range_config["sheet"]),
                    "ageGroup": "child",
                    "phase": "cognitive" if question_number in config["cognitive_numbers"] else "profile",
                    "category": infer_category("child", question_number),
                    "questionText": clean_cell(row["Question"]),
                    "featureKey": feature_key,
                    "options": options,
                }
            )

        ordered = sorted(questions, key=lambda item: (0 if item["phase"] == "cognitive" else 1, item["questionNumber"]))
        sheets[sheet_key(range_config["sheet"])] = {
            "ageRange": {"min": range_config["min_age"], "max": range_config["max_age"]},
            "questions": ordered,
        }

    return {
        "kind": "multi-sheet",
        "sheetByAge": config["sheet_by_age"],
        "sheets": sheets,
    }


def build_single_sheet_bank(age_group: str) -> dict:
    config = AGE_GROUP_CONFIG[age_group]
    frame = pd.read_excel(config["workbook"], sheet_name=config["sheet"])
    questions = []

    for index, row in frame.iterrows():
        question_number = index + 1
        raw_options = [clean_cell(value) for value in str(row["Options"]).split(";")]
        options = []
        correct_map = ADULT_CORRECT_OPTIONS if age_group == "adult" else ELDERLY_CORRECT_OPTIONS
        option_values = ADULT_OPTION_VALUES if age_group == "adult" else ELDERLY_OPTION_VALUES

        for option_index, option_text in enumerate(raw_options):
            key = chr(65 + option_index)
            is_objective = question_number in correct_map
            score = 1.0 if is_objective and key == correct_map[question_number] else 0.0 if is_objective else normalized_score(option_index, len(raw_options))
            feature_value_list = option_values.get(question_number)
            if feature_value_list and option_index < len(feature_value_list):
                feature_value = feature_value_list[option_index]
            elif is_objective:
                feature_value = 4.0 if key == correct_map[question_number] else 1.0
            else:
                feature_value = round(1 + normalized_score(option_index, len(raw_options)) * 3, 4)
            options.append(
                {
                    "key": key,
                    "text": option_text,
                    "score": round(score, 4),
                    "featureValue": round(float(feature_value), 4),
                }
            )

        questions.append(
            {
                "id": config["question_offset"] + question_number,
                "questionNumber": question_number,
                "sheetKey": sheet_key(config["sheet"]),
                "ageGroup": age_group,
                "phase": "cognitive" if question_number in config["cognitive_numbers"] else "profile",
                "category": infer_category(age_group, question_number),
                "questionText": clean_cell(row["Question"]),
                "featureKey": config["feature_map"][question_number],
                "options": options,
            }
        )

    ordered = sorted(questions, key=lambda item: (0 if item["phase"] == "cognitive" else 1, item["questionNumber"]))
    return {
        "kind": "single-sheet",
        "sheetByAge": [],
        "sheets": {
            sheet_key(config["sheet"]): {
                "ageRange": None,
                "questions": ordered,
            }
        },
    }


def to_iq_scale(series: pd.Series) -> pd.Series:
    mean = series.mean()
    std = series.std(ddof=0) or 1.0
    return 100 + 15 * ((series - mean) / std)


def build_adult_model() -> dict:
    frame = pd.read_csv(DATA_DIR / "adult_dataset.csv")
    exercise_map = {"Low": 1.0, "Medium": 2.0, "High": 3.0}
    features = pd.DataFrame(
        {
            "age": frame["Age"].astype(float),
            "sleep_duration": frame["Sleep_Duration"].astype(float),
            "stress_level": frame["Stress_Level"].astype(float),
            "daily_screen_time": frame["Daily_Screen_Time"].astype(float),
            "exercise_frequency": frame["Exercise_Frequency"].map(exercise_map).fillna(2.0).astype(float),
            "caffeine_intake": frame["Caffeine_Intake"].astype(float),
            "reaction_time": frame["Reaction_Time"].astype(float),
            "memory_test_score": frame["Memory_Test_Score"].astype(float),
            "reasoning_index": frame["Cognitive_Score"].astype(float),
        }
    )
    target = to_iq_scale(frame["AI_Predicted_Score"].astype(float))
    return train_linear_model(features, target, "adult_linear_v2")


def build_elderly_model() -> dict:
    frame = pd.read_csv(DATA_DIR / "Old_age_dataset.csv")
    features = pd.DataFrame(
        {
            "age": frame["Age"].astype(float),
            "sleep_quality_score": frame["Sleep_Quality_Score"].astype(float),
            "physical_activity_score": frame["Physical_Activity_Score"].astype(float),
            "gds_score": frame["GDS_Score"].astype(float),
            "memory_index": frame["MMSE_Score"].astype(float),
        }
    )
    target = to_iq_scale(frame["MMSE_Score"].astype(float))
    return train_linear_model(features, target, "elderly_linear_v2")


def build_child_model() -> dict:
    frame = pd.read_csv(DATA_DIR / "Child_dataset.csv")
    frame["age_years"] = frame.index.to_series().mod(18).clip(lower=0).astype(float)
    features = pd.DataFrame(
        {
            "age_years": frame["age_years"],
            "educ_cat": frame["educ_cat"].astype(float),
            "development_index": (frame["ppvt"].astype(float) / 30.0).clip(lower=1.0, upper=4.0),
        }
    )
    target = to_iq_scale(frame["ppvt"].astype(float))
    return train_linear_model(features, target, "child_linear_v2")


def train_linear_model(features: pd.DataFrame, target: pd.Series, version: str) -> dict:
    pipeline = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("model", Ridge(alpha=1.0)),
        ]
    )
    pipeline.fit(features, target)
    scaler = pipeline.named_steps["scaler"]
    model = pipeline.named_steps["model"]
    predictions = pipeline.predict(features)
    mae = abs(predictions - target).mean()

    return {
        "version": version,
        "featureNames": list(features.columns),
        "means": [round(float(value), 8) for value in scaler.mean_],
        "scales": [round(float(value) if float(value) else 1.0, 8) for value in scaler.scale_],
        "coefficients": [round(float(value), 8) for value in model.coef_],
        "intercept": round(float(model.intercept_), 8),
        "trainingRows": int(len(features)),
        "mae": round(float(mae), 4),
    }


def build_assets() -> dict:
    return {
        "branding": {
            "appName": "IQ Predictor",
            "browserTitle": "IQ Predictor",
        },
        "questionBanks": {
            "child": build_child_question_bank(),
            "adult": build_single_sheet_bank("adult"),
            "elderly": build_single_sheet_bank("elderly"),
        },
        "models": {
            "child": build_child_model(),
            "adult": build_adult_model(),
            "elderly": build_elderly_model(),
        },
        "predictionConfig": {
            "adult": {
                "defaultFeatures": {
                    "exercise_frequency": 2.0,
                },
            },
            "elderly": {
                "defaultFeatures": {},
            },
            "child": {
                "defaultFeatures": {},
            },
        },
    }


def write_ts_module(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = "// This file is generated by scripts/generate_iq_assets.py\n" \
        "export const assessmentAssets = " + json.dumps(payload, indent=2) + " as const;\n"
    path.write_text(content, encoding="utf-8")


def main() -> None:
    assets = build_assets()
    write_ts_module(FRONTEND_OUTPUT, assets)
    write_ts_module(EDGE_OUTPUT, assets)
    print(f"Generated {FRONTEND_OUTPUT}")
    print(f"Generated {EDGE_OUTPUT}")


if __name__ == "__main__":
    main()
