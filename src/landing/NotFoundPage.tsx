import fourOhFour from '@/assets/404.svg';
import FireAnimation from '@/components/fire-animation';
import { buttonVariants } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <section className="flex w-full max-w-md flex-col items-center gap-6 p-8 text-center">
        <div className="relative">
          <FireAnimation className="absolute left-10 -bottom-2 size-25" />
          <img
            src={fourOhFour}
            className="h-18 w-auto"
            alt="404 Not Found"
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            The page you were looking for could not be found.
          </p>
        </div>
        <a
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'border-border',
          )}
          href="/"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </a>
      </section>
    </main>
  );
}
