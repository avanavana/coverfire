import coverfireLogoType from '@/assets/cf-logo.svg';
import FireAnimation from '@/components/fire-animation';
import { buttonVariants } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <section className="flex w-full max-w-md flex-col items-center gap-6 p-8 text-center">
        <div className="relative">
          <FireAnimation className="absolute left-7 -bottom-2 size-25"/>
          <img src={coverfireLogoType} className="h-18 w-auto" alt="Coverfire Logo" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Customized, print-ready cover letters-as-a-service.
          </p>
        </div>
        <a className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'border-border')} href="/admin">
          View Dashboard
          <ArrowRight className="size-4" />
        </a>
      </section>
    </main>
  );
}
