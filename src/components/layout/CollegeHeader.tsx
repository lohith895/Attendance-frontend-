import { APP_TITLE } from "@/lib/appConfig";

interface CollegeHeaderProps {
  showSubtitle?: boolean;
}

export function CollegeHeader({ showSubtitle = true }: CollegeHeaderProps) {
  return (
    <div className="w-full">
      {/* College Banner */}
      <div className="w-full">
        <img
          src="/images/college-header.jpg"
          alt="Potti Sriramulu Chalavadi Mallikarjuna Rao College of Engineering & Technology"
          className="w-full h-auto object-contain"
        />
      </div>
      {/* Dept & App Title */}
      <div className="bg-primary px-4 py-4 text-center text-primary-foreground space-y-2">
        <p className="text-xs sm:text-sm font-medium tracking-wide opacity-80">
          Department of CSE-AI
        </p>
        {showSubtitle && (
          <h2 className="mx-auto max-w-6xl break-words text-sm font-display font-bold leading-snug tracking-wide sm:text-base md:text-lg lg:text-xl">
            {APP_TITLE}
          </h2>
        )}
      </div>
    </div>
  );
}
