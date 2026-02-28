import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

function contentHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function main() {
  console.log("Seeding database...");

  // ─── Admin user ────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
      status: "active",
    },
  });
  console.log(`Admin user: ${admin.email} (${admin.id})`);

  // ─── Test project ──────────────────────────────────────────────────────────
  const existingProject = await prisma.project.findFirst({
    where: { userId: admin.id, name: "My Brand (Demo)" },
  });

  if (existingProject) {
    console.log(`Project already exists: ${existingProject.name}`);
    console.log("Seeding complete.");
    return;
  }

  const project = await prisma.project.create({
    data: {
      userId: admin.id,
      name: "My Brand (Demo)",
      description: "Progetto demo per testare la piattaforma.",
      domain: "example.com",
      status: "ACTIVE",
    },
  });
  console.log(`Created project: ${project.name} (${project.id})`);

  // ─── Sample content items ──────────────────────────────────────────────────
  const items = [
    {
      url: "https://example.com/come-ottimizzare-visibilita-ai",
      title: "Come ottimizzare la visibilità AI nel 2024",
      sourcePlatform: "WEBSITE" as const,
      contentType: "ARTICLE" as const,
      discoveryMethod: "MANUAL" as const,
      status: "APPROVED" as const,
      language: "it",
      publishedAt: new Date("2024-01-15"),
      rawContent:
        "L'ottimizzazione della visibilità AI richiede una strategia contenutistica chiara, strutturata e misurabile. I brand che investono in contenuti leggibili dai modelli AI ottengono un vantaggio competitivo significativo...",
      excerpt:
        "L'ottimizzazione della visibilità AI richiede una strategia contenutistica chiara, strutturata e misurabile.",
      wordCount: 1240,
    },
    {
      url: "https://myuser.substack.com/p/newsletter-strategie-ai-2024",
      title: "Newsletter: Strategie AI per il 2024",
      sourcePlatform: "SUBSTACK" as const,
      contentType: "ARTICLE" as const,
      discoveryMethod: "MANUAL" as const,
      status: "APPROVED" as const,
      language: "it",
      publishedAt: new Date("2024-03-10"),
      rawContent:
        "Benvenuti alla newsletter mensile dedicata all'AI visibility. Questo mese esploriamo le strategie più efficaci per aumentare la presenza dei brand nei risultati dei modelli linguistici...",
      excerpt:
        "Strategie efficaci per aumentare la presenza dei brand nei risultati dei modelli linguistici.",
      wordCount: 860,
    },
    {
      url: "https://medium.com/@myuser/building-ai-readable-content",
      title: "Building AI-Readable Content: A Practical Guide",
      sourcePlatform: "MEDIUM" as const,
      contentType: "BLOG_POST" as const,
      discoveryMethod: "MANUAL" as const,
      status: "APPROVED" as const,
      language: "en",
      publishedAt: new Date("2024-02-20"),
      rawContent:
        "Creating content that ranks well with AI models requires a different approach than traditional SEO. In this guide, we cover the key principles of AI-readable content...",
      excerpt:
        "Creating content that ranks well with AI models requires a different approach than traditional SEO.",
      wordCount: 2100,
    },
    {
      url: null,
      title: "Il futuro della visibilità AI per i brand italiani",
      sourcePlatform: "LINKEDIN" as const,
      contentType: "SOCIAL_POST" as const,
      discoveryMethod: "MANUAL" as const,
      status: "DISCOVERED" as const,
      language: "it",
      publishedAt: new Date("2024-04-05"),
      rawContent:
        "Negli ultimi mesi ho analizzato oltre 50 brand italiani e il loro livello di visibilità nei modelli AI. Il risultato? Solo il 12% ha una presenza strutturata. È il momento di agire.",
      excerpt:
        "Solo il 12% dei brand italiani ha una presenza strutturata nei modelli AI. È il momento di agire.",
      wordCount: 180,
    },
  ];

  for (const item of items) {
    const hash = item.url
      ? contentHash(item.url)
      : item.rawContent
        ? contentHash(item.rawContent)
        : null;

    await prisma.contentItem.create({
      data: {
        projectId: project.id,
        contentHash: hash,
        ...item,
      },
    });
    console.log(`  + Content: "${item.title}"`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
