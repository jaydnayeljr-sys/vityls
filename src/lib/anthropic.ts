// ===========================================================================
// Vitals — Claude API integration.
//
// Turns a free-text meal description into a structured nutrition breakdown.
// Uses Claude's tool-use so the model is forced to return clean JSON.
// Server-only: the API key must never reach the browser.
// ===========================================================================

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  MICRO_KEYS,
  MICRO_LABELS,
  type ExtractedItem,
  type ExtractedMeal,
  type MealSlot,
  type Micros,
} from "./nutrition-types";

const apiKey = process.env.ANTHROPIC_API_KEY;

/** True once ANTHROPIC_API_KEY has been set in the environment. */
export const anthropicConfigured = Boolean(apiKey);

// Model used for nutrition extraction. Change here if needed.
const MODEL = "claude-sonnet-4-6";

const client = new Anthropic({ apiKey: apiKey ?? "" });

// --- tool definition --------------------------------------------------------

const microProps = Object.fromEntries(
  MICRO_KEYS.map((k) => [
    k,
    { type: "number", description: `${MICRO_LABELS[k]} content` },
  ]),
);

const NUTRITION_TOOL: Anthropic.Tool = {
  name: "log_nutrition",
  description:
    "Record the structured nutrition breakdown of a meal the user described.",
  input_schema: {
    type: "object",
    properties: {
      meal: {
        type: "string",
        enum: ["breakfast", "lunch", "dinner", "snack"],
        description:
          "Which meal slot this is. Infer from the description and time of day.",
      },
      items: {
        type: "array",
        description: "One entry per distinct food or drink in the meal.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            source: {
              type: "string",
              enum: ["IFCT_2017", "USDA_FDC", "WEB", "estimate"],
              description:
                "Where the figures came from: IFCT_2017 (Indian Food Composition Tables), USDA_FDC (USDA FoodData Central), WEB (another reputable web source such as a brand label), or estimate when no reliable source was found.",
            },
            quantity: {
              type: "string",
              description:
                "Human-readable portion, e.g. '2 medium rotis' or '150 g'.",
            },
            calories: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" },
            fiber_g: { type: "number" },
            micros: {
              type: "object",
              description:
                "Micronutrients. Omit a key if not meaningfully present.",
              properties: microProps,
            },
          },
          required: [
            "name",
            "source",
            "quantity",
            "calories",
            "protein_g",
            "carbs_g",
            "fat_g",
            "fiber_g",
            "micros",
          ],
        },
      },
      summary: {
        type: "string",
        description:
          "One or two warm, concise sentences for the user: what was logged plus one useful nutrition observation.",
      },
      clarification_needed: {
        type: "boolean",
        description:
          "True only if the description is too vague to estimate even roughly.",
      },
      clarification_question: {
        type: "string",
        description: "If clarification is needed, the single question to ask.",
      },
    },
    required: [
      "meal",
      "items",
      "summary",
      "clarification_needed",
      "clarification_question",
    ],
  },
};

const SYSTEM_PROMPT = `You are the nutrition analyst inside Vitals, a personal health app.
The user describes what they ate in plain language; you return an accurate,
structured breakdown. Accuracy matters more than speed.

Method — follow this for every meal:
1. For each distinct food or drink, use the web_search tool to look up its
   nutrition data. Prefer reputable sources: USDA FoodData Central, the Indian
   Food Composition Tables (IFCT 2017, ICMR-NIN), official brand or product
   nutrition labels, and government or university nutrition databases. Treat
   recipe blogs and crowd-sourced trackers as weak sources.
2. Cross-check the figures against known reference ranges so that a single
   outlier page cannot skew the result. If sources disagree, use the most
   authoritative one.
3. Scale the per-100g or per-serving values to the portion the user actually
   ate. When the user is not precise (e.g. "2 rotis and dal"), assume typical
   home-cooked portions and state what you assumed in "quantity".
4. Call log_nutrition with the result.

Source tag for each item:
- "IFCT_2017"  — value taken from the Indian Food Composition Tables
- "USDA_FDC"   — value taken from USDA FoodData Central
- "WEB"        — value taken from another reputable web source (brand label etc.)
- "estimate"   — no reliable source found; the figure is your best estimate

Rules:
- The user mostly eats Indian food, so IFCT 2017 and Indian brand labels are
  often the best match — prefer them for Indian dishes and ingredients.
- Provide calories, protein, carbs, fat and fibre for every item, plus
  micronutrients where meaningfully present. Units: *_mg in milligrams,
  vitamin_d_iu in IU, vitamin_b12_ug in micrograms, omega3_g in grams.
- Only set clarification_needed = true when the description is genuinely too
  vague to research even roughly. A normal home meal description is NOT too vague.
- Keep "summary" friendly and brief, with one genuinely useful observation.
- You MUST end your turn by calling the log_nutrition tool.`;

// --- extraction -------------------------------------------------------------

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : 0;
}

function normalizeItem(raw: Record<string, unknown>): ExtractedItem {
  const rawMicros = (raw.micros as Record<string, unknown>) ?? {};
  const micros: Micros = {};
  for (const k of MICRO_KEYS) {
    if (rawMicros[k] != null) micros[k] = n(rawMicros[k]);
  }
  const src = raw.source;
  return {
    name: String(raw.name ?? "Food"),
    source:
      src === "IFCT_2017" || src === "USDA_FDC" || src === "WEB"
        ? src
        : "estimate",
    quantity: String(raw.quantity ?? ""),
    calories: n(raw.calories),
    protein_g: n(raw.protein_g),
    carbs_g: n(raw.carbs_g),
    fat_g: n(raw.fat_g),
    fiber_g: n(raw.fiber_g),
    micros,
  };
}

/** Finds the log_nutrition tool call in a Claude response, if present. */
function findLogToolUse(
  m: Anthropic.Message,
): Anthropic.ToolUseBlock | undefined {
  return m.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === "log_nutrition",
  );
}

/**
 * Sends the user's meal description to Claude and returns a structured meal.
 * Throws if the API key is missing or the call fails.
 */
export async function extractNutrition(text: string): Promise<ExtractedMeal> {
  if (!anthropicConfigured) {
    throw new Error(
      "The AI assistant is not configured — add ANTHROPIC_API_KEY to .env.local.",
    );
  }

  const hour = new Date().getHours();
  const timeHint =
    hour < 11
      ? "morning"
      : hour < 16
        ? "afternoon"
        : hour < 21
          ? "evening"
          : "night";

  // Tools: the built-in web_search server tool (so the model can look up real
  // nutrition data) plus our custom log_nutrition tool for the structured reply.
  const searchTools = [
    { type: "web_search_20250305", name: "web_search", max_uses: 8 },
    NUTRITION_TOOL,
  ] as Anthropic.Messages.MessageCreateParams["tools"];

  const userContent =
    `It is currently ${timeHint}. The user logged:\n\n"${text}"\n\n` +
    `Research each item's nutrition on the web, then call log_nutrition.`;

  const forceNudge =
    "Call the log_nutrition tool now with the full breakdown for the meal " +
    "above. If the description is too vague to research, still call the tool " +
    "and set clarification_needed = true with a question.";

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  // --- Phase 1: let the model search the web and call the tool itself. ------
  let msg: Anthropic.Message | null = null;
  let searchWorked = false;
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: searchTools,
      messages,
    });
    // A long-running web search can pause the turn; feed the partial response
    // back so the model can continue until it finishes.
    let guard = 0;
    while (msg.stop_reason === "pause_turn" && guard < 8) {
      messages.push({ role: "assistant", content: msg.content });
      msg = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: searchTools,
        messages,
      });
      guard += 1;
    }
    searchWorked = true;
  } catch {
    // Web search may be unavailable for this account — fall through to a
    // forced, no-search call below so meal logging always works.
    msg = null;
  }

  let toolUse = msg ? findLogToolUse(msg) : undefined;

  // --- Phase 2: guarantee a structured result. ------------------------------
  // If the model searched but replied in prose (or search itself failed),
  // force the log_nutrition call so the meal is always actually saved.
  if (!toolUse) {
    let convo: Anthropic.MessageParam[];
    let tools = searchTools;
    if (searchWorked && msg) {
      messages.push({ role: "assistant", content: msg.content });
      messages.push({ role: "user", content: forceNudge });
      convo = messages;
    } else {
      convo = [{ role: "user", content: `${userContent}\n\n${forceNudge}` }];
      tools = [NUTRITION_TOOL] as Anthropic.Messages.MessageCreateParams["tools"];
    }
    const forced = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: "tool", name: "log_nutrition" },
      messages: convo,
    });
    toolUse = findLogToolUse(forced);
  }

  if (!toolUse) {
    throw new Error(
      "The AI did not return a structured result. Please try again.",
    );
  }

  const input = toolUse.input as Record<string, unknown>;
  const rawItems = Array.isArray(input.items) ? input.items : [];

  return {
    meal: (["breakfast", "lunch", "dinner", "snack"].includes(
      String(input.meal),
    )
      ? input.meal
      : "snack") as MealSlot,
    rawText: text,
    items: rawItems.map((it) => normalizeItem(it as Record<string, unknown>)),
    summary: String(input.summary ?? "Logged."),
    clarificationNeeded: Boolean(input.clarification_needed),
    clarificationQuestion: String(input.clarification_question ?? ""),
  };
}
