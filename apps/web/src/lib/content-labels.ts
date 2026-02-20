import type {
  SourcePlatform,
  ContentType,
  ContentStatus,
  DiscoveryMethod,
} from "@prisma/client";

export const PLATFORM_LABELS: Record<SourcePlatform, string> = {
  WEBSITE: "Website",
  SUBSTACK: "Substack",
  MEDIUM: "Medium",
  LINKEDIN: "LinkedIn",
  REDDIT: "Reddit",
  QUORA: "Quora",
  YOUTUBE: "YouTube",
  TWITTER: "Twitter / X",
  NEWS: "News",
  OTHER: "Altro",
};

export const TYPE_LABELS: Record<ContentType, string> = {
  ARTICLE: "Articolo",
  BLOG_POST: "Blog Post",
  PAGE: "Pagina",
  SOCIAL_POST: "Post Social",
  COMMENT: "Commento",
  MENTION: "Menzione",
  VIDEO: "Video",
  PODCAST: "Podcast",
  OTHER: "Altro",
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  DISCOVERED: "Trovato",
  APPROVED: "Approvato",
  REJECTED: "Rifiutato",
  ARCHIVED: "Archiviato",
};

export const STATUS_COLORS: Record<ContentStatus, string> = {
  DISCOVERED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVED:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export const DISCOVERY_LABELS: Record<DiscoveryMethod, string> = {
  MANUAL: "Aggiunto manualmente",
  CSV_IMPORT: "Importato da CSV",
  AGENT_CRAWL: "Trovato dal crawler",
  AGENT_SEARCH: "Trovato tramite ricerca",
};
