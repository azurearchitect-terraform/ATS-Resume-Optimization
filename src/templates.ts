export interface TemplateConfig {
  id: string;
  name: string;
  sectionOrder: string[];
  typography: {
    fontFamily: string;
    headerSize: number;
    sectionTitleSize: number;
    bodySize: number;
    lineHeight: number;
  };
  spacing: {
    margins: { top: number; right: number; bottom: number; left: number };
    sectionGap: number;
    itemGap: number;
    bulletGap: number;
  };
  styles: {
    alignment: 'left' | 'center';
    dividerStyle: 'line' | 'none';
  };
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  azureArchitect: {
    id: 'azureArchitect',
    name: 'Azure Architect',
    sectionOrder: ['summary', 'skills', 'experience', 'certifications', 'education'],
    typography: {
      fontFamily: 'Inter',
      headerSize: 24,
      sectionTitleSize: 14,
      bodySize: 10,
      lineHeight: 1.5,
    },
    spacing: {
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      sectionGap: 20,
      itemGap: 10,
      bulletGap: 4,
    },
    styles: {
      alignment: 'left',
      dividerStyle: 'line',
    }
  },
  devOpsEngineer: {
    id: 'devOpsEngineer',
    name: 'DevOps Engineer',
    sectionOrder: ['skills', 'experience', 'projects', 'education'],
    typography: {
      fontFamily: 'JetBrains Mono',
      headerSize: 22,
      sectionTitleSize: 13,
      bodySize: 9.5,
      lineHeight: 1.4,
    },
    spacing: {
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      sectionGap: 16,
      itemGap: 8,
      bulletGap: 3,
    },
    styles: {
      alignment: 'left',
      dividerStyle: 'none',
    }
  },
  cloudOperations: {
    id: 'cloudOperations',
    name: 'Cloud Operations',
    sectionOrder: ['summary', 'experience', 'skills', 'education'],
    typography: {
      fontFamily: 'Roboto',
      headerSize: 24,
      sectionTitleSize: 14,
      bodySize: 10,
      lineHeight: 1.5,
    },
    spacing: {
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      sectionGap: 18,
      itemGap: 10,
      bulletGap: 4,
    },
    styles: {
      alignment: 'left',
      dividerStyle: 'line',
    }
  },
  executiveLeadership: {
    id: 'executiveLeadership',
    name: 'Executive Leadership',
    sectionOrder: ['summary', 'experience', 'education', 'skills'],
    typography: {
      fontFamily: 'Playfair Display',
      headerSize: 28,
      sectionTitleSize: 16,
      bodySize: 11,
      lineHeight: 1.6,
    },
    spacing: {
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      sectionGap: 24,
      itemGap: 12,
      bulletGap: 5,
    },
    styles: {
      alignment: 'center',
      dividerStyle: 'line',
    }
  }
};
