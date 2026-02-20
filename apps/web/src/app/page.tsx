import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          AI Visibility Platform
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Monitor and optimize your AI visibility across platforms
        </p>
      </div>
      <div className="flex gap-4">
        <Button>Get Started</Button>
        <Button variant="outline">Learn More</Button>
      </div>
    </main>
  );
}
