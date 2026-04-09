export const MODE_DESCRIPTIONS = {
  conservative: "Minimal edits. Preserves your original structure and wording while ensuring basic keyword alignment.",
  balanced: "The 'Sweet Spot'. Improves clarity, strengthens action verbs, and strategically aligns keywords. Recommended.",
  aggressive: "Maximum Impact. Rewrites bullets for peak ATS compatibility and high-stakes competitive roles."
};

export const AUDIENCES = [
  { id: 'general', label: 'General Professional', icon: '👤' },
  { id: 'microsoft', label: 'Microsoft / Enterprise', icon: '🏢' },
  { id: 'leadership', label: 'Leadership / Manager', icon: '👔' },
  { id: 'cloud-architect', label: 'Cloud Architect', icon: '☁️' },
  { id: 'solution-architect', label: 'Solution Architect', icon: '🏗️' },
  { id: 'consulting', label: 'Consulting / Client-Facing', icon: '🤝' },
  { id: 'cloud-eng-mgr', label: 'Cloud Engineering Manager', icon: '⚙️' },
  { id: 'infra-mgr', label: 'Infrastructure Manager', icon: '🛠️' },
  { id: 'assoc-director', label: 'Associate Director / Lead roles', icon: '🎖️' },
  { id: 'director-mid', label: 'Director / Head of Cloud (mid-size)', icon: '📈' },
  { id: 'director-large', label: 'Director / Head of Cloud (large-size)', icon: '🌐' },
  { id: 'principal-architect', label: 'Principal Cloud Architect', icon: '💎' },
  { id: 'cto-vp', label: 'CTO / VP of Engineering', icon: '👑' },
  { id: 'digital-transform', label: 'Digital Transformation Lead', icon: '⚡' },
  { id: 'platform-dir', label: 'Platform Engineering Director', icon: '🏗️' }
];

export const MODEL_PRICING: Record<string, { input: number, output: number }> = {
  // OpenAI
  'gpt-5.4': { input: 5.00, output: 15.00 },
  'gpt-5.4-mini': { input: 0.15, output: 0.60 },
  'gpt-5.4-nano': { input: 0.05, output: 0.20 },
  'o1': { input: 15.00, output: 60.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'gpt-4.5': { input: 75.00, output: 150.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  // Gemini
  'gemini-3.1-pro-preview': { input: 1.25, output: 5.00 },
  'gemini-3-flash-preview': { input: 0.075, output: 0.30 },
  'gemini-flash-latest': { input: 0.075, output: 0.30 },
  'gemini-3.1-flash-lite-preview': { input: 0.075, output: 0.30 },
};
