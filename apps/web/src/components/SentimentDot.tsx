import { classifyHeadline } from "../lib/sentiment";

/** A small tone indicator next to a headline — keyword-heuristic, not real
 * NLP, just enough to scan a long list for what's worth opening first. */
export function SentimentDot({ headline }: { headline: string }) {
  const sentiment = classifyHeadline(headline);
  const title =
    sentiment === "positive"
      ? "Tone: positive (keyword heuristic)"
      : sentiment === "negative"
        ? "Tone: negative (keyword heuristic)"
        : "Tone: neutral";
  return <span className={`sentiment-dot sentiment-${sentiment}`} title={title} />;
}
