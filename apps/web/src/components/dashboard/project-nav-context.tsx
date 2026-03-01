"use client";

import { createContext, useContext } from "react";

interface ProjectNavState {
  projectId: string;
  projectName: string;
}

const ProjectNavContext = createContext<ProjectNavState | null>(null);

export function ProjectNavProvider({
  projectId,
  projectName,
  children,
}: {
  projectId: string;
  projectName: string;
  children: React.ReactNode;
}) {
  return (
    <ProjectNavContext.Provider value={{ projectId, projectName }}>
      {children}
    </ProjectNavContext.Provider>
  );
}

export function useProjectNav(): ProjectNavState | null {
  return useContext(ProjectNavContext);
}
