"""Micro impact: personal PM2.5 dose. Never inferred from emissions (see commute.factors).

Dose (µg) = concentration (µg/m³) x inhalation rate (m³/min) x minutes. Rates are the EPA
Exposure Factors Handbook 2011, Table 6-2 means for adults 31 to <41 years.
"""

SEDENTARY, LIGHT, MODERATE, HIGH = 4.3e-3, 1.2e-2, 2.7e-2, 4.9e-2


def inhaled_ug(pm25: float, rate_m3_per_min: float, minutes: float) -> float:
    """Micrograms of PM2.5 breathed in, rounded to 0.1 µg."""
    return round(pm25 * rate_m3_per_min * minutes, 1)
