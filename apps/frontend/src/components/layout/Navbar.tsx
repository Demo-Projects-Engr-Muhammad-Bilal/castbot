"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth, UserButton } from "@clerk/nextjs";
import { ArrowRight, Sparkles, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { isSignedIn, isLoaded } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border/80 shadow-md py-3"
          : "bg-background/50 backdrop-blur-md border-b border-border/40 py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between relative">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
          <Image
            src="/logo/logo.jpeg"
            alt="CastBot Logo"
            width={40}
            height={40}
            className="rounded-xl object-cover shadow-sm group-hover:scale-105 transition-transform"
          />
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-foreground flex items-center gap-1.5">
              CastBot
              <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-extrabold tracking-wider uppercase">
                v2.0
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium -mt-1">
              Multi-Channel Dispatch
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links (How It Works FIRST, Features SECOND) */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-muted-foreground">
          <Link href="#how-it-works" className="hover:text-foreground transition-colors">
            How It Works
          </Link>
          <Link href="#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
        </nav>

        {/* Auth CTA Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl px-5 py-2.5 shadow-md shadow-primary/20 flex items-center gap-2 cursor-pointer">
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 rounded-full ring-2 ring-primary/20 hover:scale-105 transition-transform",
                  },
                }}
                showName={false}
              />
            </div>
          ) : (
            <>
              <Link href="/sign-in">
                <Button
                  variant="ghost"
                  className="text-xs font-bold text-muted-foreground hover:text-foreground rounded-xl cursor-pointer"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl px-5 py-2.5 shadow-md shadow-primary/20 flex items-center gap-2 cursor-pointer">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Get Started Free</span>
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Mobile Dropdown Absolute Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-slate-900/95 backdrop-blur-md shadow-2xl z-50 border-b border-white/10 p-4 space-y-4 animate-fade-in">
            <div className="flex flex-col space-y-3 text-xs font-bold text-muted-foreground">
              <Link href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">
                How It Works
              </Link>
              <Link href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">
                Features
              </Link>
              <Link href="#pricing" onClick={() => setMobileMenuOpen(false)} className="hover:text-foreground py-1">
                Pricing
              </Link>
            </div>
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              {isLoaded && isSignedIn ? (
                <div className="flex items-center justify-between pt-1">
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex-1 mr-3">
                    <Button className="w-full bg-primary text-primary-foreground font-bold text-xs rounded-xl py-2.5">
                      Go to Dashboard
                    </Button>
                  </Link>
                  <UserButton showName={false} />
                </div>
              ) : (
                <>
                  <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full text-xs font-bold rounded-xl py-2.5">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full bg-primary text-primary-foreground font-bold text-xs rounded-xl py-2.5">
                      Get Started Free
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
