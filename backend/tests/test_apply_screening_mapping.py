"""
Unit tests for screening-question field detection
(see docs/decisions/apply-chat-flow-redesign.md).

With no built-in questions, the head's configured screening questions are
classified by `field_key` + `label` so their answers still feed the structured
features: encrypted compensation and experience-based ATS scoring. Pure functions,
no DB.
"""
from backend.services.apply_service import (
    classify_screening_field,
    map_screening_to_structured,
)


def test_classify_detects_known_fields():
    assert classify_screening_field("current_ctc", "Current CTC") == "compensation"
    assert classify_screening_field("expected_salary", "Expected Salary") == "compensation"
    assert classify_screening_field("total_experience", "Years of Experience") == "experience"
    assert classify_screening_field("notice", "Notice Period / Availability") == "notice_period"
    assert classify_screening_field("current_org", "Current Organization") == "current_role"
    assert classify_screening_field("favorite_color", "Favorite color") is None


def test_company_not_misread_as_compensation():
    # "company" contains the substring "comp" — must NOT match compensation.
    assert classify_screening_field("current_company", "Current Company") == "current_role"


def test_map_routes_answers_into_structured_slots():
    raw = {
        "current_ctc": "25 LPA",
        "expected_ctc": "35 LPA",
        "total_experience": "7 years",
        "notice_period": "60 days",
        "current_role": "Senior Engineer at Acme",
    }
    labels = {
        "current_ctc": "Current CTC",
        "expected_ctc": "Expected CTC",
        "total_experience": "Total Experience",
        "notice_period": "Notice Period",
        "current_role": "Current Role",
    }
    out = map_screening_to_structured(raw, labels)
    assert out["compensation_current"] == "25 LPA"
    assert out["compensation_expected"] == "35 LPA"
    assert out["experience_total"] == "7 years"
    assert out["experience_years_int"] == 7
    assert out["notice_period"] == "60 days"
    assert out["current_title"] == "Senior Engineer"
    assert out["current_company"] == "Acme"


def test_map_ignores_blank_answers_and_unknown_fields():
    out = map_screening_to_structured(
        {"hobby": "chess", "ctc": "", "exp": None},
        {"hobby": "Hobby", "ctc": "CTC", "exp": "Experience"},
    )
    assert out == {}
