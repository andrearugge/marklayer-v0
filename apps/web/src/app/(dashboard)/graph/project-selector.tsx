"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Project {
  id: string;
  name: string;
}

interface Props {
  projects: Project[];
  current: string;
}

export function ProjectSelector({ projects, current }: Props) {
  const router = useRouter();

  return (
    <Select
      value={current}
      onValueChange={(id) => router.push(`/graph?projectId=${id}`)}
    >
      <SelectTrigger className="w-52">
        <SelectValue placeholder="Seleziona progetto" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
