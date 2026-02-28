import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicSample {
  content: { id: string; title: string };
}

export interface TopicItem {
  id: string;
  label: string;
  frequency: number;
  contentEntities: TopicSample[];
}

interface Props {
  topics: TopicItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicsPanel({ topics }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4" />
          Topic rilevati
          {topics.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              ({topics.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nessun topic trovato. Genera gli embedding e avvia il clustering per rilevare i topic.
          </p>
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => (
              <div key={topic.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{topic.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {topic.frequency} contenut{topic.frequency === 1 ? "o" : "i"}
                  </span>
                </div>
                {topic.contentEntities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {topic.contentEntities.map(({ content }) => (
                      <span
                        key={content.id}
                        className="inline-block rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground truncate max-w-[180px]"
                        title={content.title}
                      >
                        {content.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
