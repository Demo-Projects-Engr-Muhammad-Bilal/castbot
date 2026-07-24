import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{
        layout: {
          socialButtonsPlacement: "bottom",
          showOptionalFields: false,
        },
        elements: {
          rootBox: "w-full max-w-full",
          cardBox:
            "w-full max-w-[420px] shadow-xl border border-slate-200 bg-white rounded-3xl",
          card: "w-full max-w-full bg-transparent shadow-none border-none p-6 md:p-8 text-slate-900",
          headerTitle: "text-slate-900 font-black text-2xl tracking-tight",
          headerSubtitle: "text-slate-500 text-xs mt-1",
          socialButtonsBlockButton:
            "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl py-2.5 w-full transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs",
          socialButtonsBlockButtonText: "font-bold text-slate-700 text-xs",
          formButtonPrimary:
            "bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl py-3 transition-all cursor-pointer shadow-md shadow-blue-600/20",
          footerActionLink: "text-blue-600 hover:text-blue-700 font-bold transition-colors",
          formFieldInput:
            "rounded-xl border border-slate-200 bg-white text-slate-900 text-xs py-2.5 px-3.5 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all",
          formFieldLabel: "text-slate-700 text-xs font-bold mb-1.5",
          dividerLine: "bg-slate-200",
          dividerText: "text-slate-500 text-[10px] font-bold px-3 uppercase tracking-wider",
          identityPreviewText: "text-slate-800 font-semibold text-xs",
          identityPreviewEditButtonIcon: "text-blue-600",
          formResendCodeLink: "text-blue-600 hover:text-blue-700 font-bold text-xs",
        },
      } as any}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard"
    />
  );
}
