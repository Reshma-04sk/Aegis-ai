"""POST /api/plan request body: strict, bounded input (extra fields and type coercion refused)."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from .enums import Activity, Group, Mode

Place = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class _Strict(BaseModel):
    # Unknown fields are rejected, and numeric fields are declared strict: JSON booleans and
    # numeric strings are refused instead of being silently coerced (found by API fuzzing).
    model_config = ConfigDict(extra="forbid")


class Member(_Strict):
    """One person in the household."""

    name: Label = "You"
    groups: list[Group] = Field(default_factory=list, max_length=5)


class PlannedActivity(_Strict):
    """An outdoor plan to schedule into the cleanest hours."""

    label: Label
    activity: Activity
    duration_hours: float = Field(strict=True, ge=0.25, le=8)
    earliest_hour: int = Field(strict=True, default=6, ge=0, le=23)
    latest_hour: int = Field(strict=True, default=22, ge=1, le=24)

    @model_validator(mode="after")
    def _check_range(self) -> PlannedActivity:
        if self.latest_hour - self.earliest_hour < self.duration_hours:
            raise ValueError("time range is shorter than the activity")
        return self


class Home(_Strict):
    """Main room and optional purifier, for indoor advice."""

    floor_area_m2: float = Field(strict=True, ge=4, le=200)
    ceiling_height_m: float = Field(strict=True, default=2.7, ge=2, le=5)
    purifier_cadr_m3h: float | None = Field(strict=True, default=None, ge=0, le=3000)


class Commute(_Strict):
    """A regular trip, for the emissions and exposure comparison."""

    distance_km: float = Field(strict=True, gt=0, le=100)
    current_mode: Mode
    occupants: int = Field(strict=True, default=1, ge=1, le=7)
    trips_per_week: int = Field(strict=True, default=10, ge=1, le=28)


class PlanRequest(_Strict):
    """POST /api/plan body: a place (name or coordinates) plus household details."""

    location: Place | None = None
    latitude: float | None = Field(strict=True, default=None, ge=-90, le=90)
    longitude: float | None = Field(strict=True, default=None, ge=-180, le=180)
    members: list[Member] = Field(default_factory=lambda: [Member()], min_length=1, max_length=8)
    activities: list[PlannedActivity] = Field(default_factory=list, max_length=6)
    home: Home | None = None
    commute: Commute | None = None
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None

    @model_validator(mode="after")
    def _check_location(self) -> PlanRequest:
        has_lat, has_lon = self.latitude is not None, self.longitude is not None
        if has_lat != has_lon:
            raise ValueError("latitude and longitude must be provided together")
        if not self.location and not has_lat:
            raise ValueError("provide a location name or latitude/longitude")
        return self
