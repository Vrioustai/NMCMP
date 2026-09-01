export type MovieSummary = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  rating: number | null;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
