// TODO: Before launch, route API calls through a Supabase Edge Function
// to avoid exposing the OpenAI key in the client bundle.
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY!;

export const OPENAI_BASE_URL = "https://api.openai.com/v1";

export async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  model = "gpt-4o-mini"
): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI chat error: ${err}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
}

export async function getRealtimeEphemeralKey(): Promise<string> {
  const res = await fetch(`${OPENAI_BASE_URL}/realtime/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o-realtime-preview" }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Realtime session error: ${err}`);
  }

  const data = await res.json() as { client_secret: { value: string } };
  return data.client_secret.value;
}

export { OPENAI_API_KEY };
