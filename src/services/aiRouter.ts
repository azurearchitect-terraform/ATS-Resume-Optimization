import { EngineConfig, EngineType } from './geminiService';

export type TaskType = 
  | 'parse_resume'
  | 'extract_job_description'
  | 'extract_skills'
  | 'ats_scoring'
  | 'rewrite_resume'
  | 'multi_audience'
  | 'recruiter_simulation'
  | 'interview_questions'
  | 'cover_letter';

export interface RouterConfig {
  mode: EngineType | 'production';
  geminiConfig: EngineConfig;
  openaiConfig: EngineConfig;
}

export function routeTask(task: TaskType, config: RouterConfig): EngineConfig {
  if (config.mode !== 'production') {
    // If not in production mode, use the explicitly selected engine
    return config.mode === 'gemini' ? config.geminiConfig : config.openaiConfig;
  }

  // Production Mode Routing Logic
  let selectedEngine: EngineType;

  switch (task) {
    // Tasks routed to Gemini
    case 'parse_resume':
    case 'extract_job_description':
    case 'extract_skills':
    case 'ats_scoring':
      selectedEngine = 'gemini';
      break;

    // Tasks routed to OpenAI
    case 'rewrite_resume':
    case 'multi_audience':
    case 'recruiter_simulation':
    case 'interview_questions':
    case 'cover_letter':
      selectedEngine = 'openai';
      break;
      
    default:
      // Fallback to Gemini if task is unknown
      selectedEngine = 'gemini';
  }

  const engineConfig = selectedEngine === 'gemini' ? config.geminiConfig : config.openaiConfig;
  
  // Log the routing decision
  console.log(`[Production Mode] Task: ${task} → ${selectedEngine === 'gemini' ? 'Gemini' : 'OpenAI'} (${engineConfig.model})`);
  
  return engineConfig;
}
