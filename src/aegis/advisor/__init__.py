"""Plain-language briefings: the Advisor port, the Gemini adapter and the rules fallback."""

from .briefing import rules_briefing
from .gemini import GeminiAdvisor
from .port import Advisor, Source

__all__ = ["Advisor", "GeminiAdvisor", "Source", "rules_briefing"]
