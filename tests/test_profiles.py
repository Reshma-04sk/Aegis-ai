import pytest

from aegis.models import Activity, Group
from aegis.profiles import extract_from_note


def test_empty_note():
    assert extract_from_note(None) == (set(), None)
    assert extract_from_note("") == (set(), None)


def test_detects_group_and_activity():
    groups, activity = extract_from_note("I have asthma and want to jog this evening")
    assert groups == {Group.ASTHMA}
    assert activity is Activity.RUN


def test_most_intense_activity_wins():
    _, activity = extract_from_note("walk to the park then go running")
    assert activity is Activity.RUN


@pytest.mark.parametrize(
    "note", ["I do not have asthma", "no asthma here", "never had a heart condition"]
)
def test_negation_is_respected(note):
    groups, _ = extract_from_note(note)
    assert groups == set()


def test_multiple_groups():
    groups, activity = extract_from_note("taking my toddler and grandmother for a walk")
    assert groups == {Group.CHILD, Group.ELDERLY}
    assert activity is Activity.WALK


def test_pregnancy_and_heart_and_cycling():
    groups, activity = extract_from_note(
        "I am pregnant, heart disease runs in family, cycling to work"
    )
    assert Group.PREGNANT in groups and Group.HEART in groups
    assert activity is Activity.CYCLE
