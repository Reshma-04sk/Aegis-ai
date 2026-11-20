// Briefing card: the plain-language summary and where it came from. The plan arrives with a
// rule-based briefing; Gemini's version replaces it if it comes back for *this* plan.
import { useEffect, useState } from "react";
import { Card } from "../../components/Card";
import { postBriefing } from "../../lib/api";
import type { PlanResponse } from "../../lib/types";

export const SOURCE_TEXT = {
  gemini: "Written by Google Gemini from the computed plan; it cannot change verdicts or numbers.",
  rules: "Rule-based briefing.",
  pending: "Rule-based briefing; asking Google Gemini for a personalised version…",
};

interface Text {
  explanation: string;
  source: keyof typeof SOURCE_TEXT;
}

function useBriefing(plan: PlanResponse): Text {
  const initial: Text = {
    explanation: plan.explanation,
    source: plan.briefing_id ? "pending" : plan.explanation_source,
  };
  const [text, setText] = useState<Text>(initial);
  useEffect(() => {
    if (!plan.briefing_id) return undefined;
    let current = true; // a newer plan must never receive an older plan's briefing
    void postBriefing(plan.briefing_id)
      .catch(() => null)
      .then((b) => {
        if (!current) return;
        const fromGemini = b?.explanation_source === "gemini";
        setText({
          explanation: fromGemini ? b.explanation : plan.explanation,
          source: fromGemini ? "gemini" : "rules",
        });
      });
    return () => {
      current = false;
    };
  }, [plan]);
  return text;
}

/** "Your briefing", upgraded in place when the AI version arrives. */
export function Briefing({ plan }: { plan: PlanResponse }) {
  const text = useBriefing(plan);
  return (
    <Card title="Your briefing" className="briefing">
      <p className="lead">{text.explanation}</p>
      <p className="help">{SOURCE_TEXT[text.source]}</p>
    </Card>
  );
}
