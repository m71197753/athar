// Optional scene metadata for Replit workspace integrations. When the
// workspace's scene controls are enabled for this project, a viewer's click on
// a scene segment scopes their next chat request to that scene's source file.
// Fill one entry per SCENE_DURATIONS key in VideoTemplate.tsx only when a
// skill reference asks for it; otherwise leave the map empty. Scenes missing
// from the map still play and can be jumped to.
//
// Example:
//   export const SCENE_DETAILS: Record<string, SceneDetails> = {
//     open: { title: 'Intro', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
//   };

export interface SceneDetails {
  title: string;
  filePath: string;
}

const S = 'src/components/video/video_scenes/';
export const SCENE_DETAILS: Record<string, SceneDetails> = {
  cover: { title: 'الغلاف', filePath: S + 'Cover.tsx' },
  problem: { title: 'المشكلة', filePath: S + 'Problem.tsx' },
  solution: { title: 'الحل', filePath: S + 'Solution.tsx' },
  steps: { title: 'خطوات الحل', filePath: S + 'Steps.tsx' },
  courses: { title: 'الدورات', filePath: 'src/components/video/data.ts' },
  languages: { title: 'اللغات', filePath: 'src/components/video/data.ts' },
  achievements: { title: 'الإنجازات', filePath: 'src/components/video/data.ts' },
  resume: { title: 'السيرة ATS', filePath: 'src/components/video/data.ts' },
  career: { title: 'الخطة المهنية', filePath: 'src/components/video/data.ts' },
  office: { title: 'المستندات والجداول', filePath: 'src/components/video/data.ts' },
  admin: { title: 'الإدارة', filePath: 'src/components/video/data.ts' },
  thanks: { title: 'شكرًا', filePath: S + 'Thanks.tsx' },
};
