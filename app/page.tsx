"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight, Mail, Globe, Check } from "lucide-react";
import { useHomeController } from "@/hooks/use-home-controller";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const deskRows = [
  { name: "Willow Creek HOA", meta: "Austin · replied", tone: "Replied" },
  { name: "Harbor Point", meta: "Tampa · day 3", tone: "Sent" },
  { name: "Cedar Ridge", meta: "Denver · queued", tone: "Queued" },
];

export default function HomePage() {
  const { features, heroContent, featuresContent, ctaContent } =
    useHomeController();

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
          <div className="animate-rise-in">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-[#8a6a45] lg:text-left">
              For outreach teams who work the list
            </p>
            <h1 className="text-center text-4xl font-semibold leading-[1.05] text-[#1a1814] sm:text-5xl lg:text-left lg:text-6xl">
              {heroContent.title.main}
              <span className="mt-2 block text-[#1e4d42]">
                {heroContent.title.accent}
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-center text-base leading-relaxed text-[#5c5348] sm:text-lg lg:mx-0 lg:text-left">
              {heroContent.description}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 w-full rounded-full px-7 text-base sm:w-auto"
                )}
              >
                Open the desk
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#workflow"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "h-12 w-full rounded-full border-[#d9cbb6] bg-white/70 px-7 text-base hover:bg-white sm:w-auto"
                )}
              >
                See the workflow
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-[#6b6156] lg:justify-start">
              {["Photo to property names", "Templates you control", "Reply tracking"].map(
                (item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#1e4d42]" />
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="animate-rise-in relative [animation-delay:120ms]">
            <div className="absolute -left-6 top-10 hidden h-24 w-24 rounded-full bg-[#c9894a]/20 blur-2xl lg:block" />
            <div className="relative rounded-[28px] border border-[#e4d3bc] bg-white p-4 shadow-lift sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#8a6a45]">
                    Campaign desk
                  </p>
                  <p className="font-display text-2xl text-[#1a1814]">Day 4</p>
                </div>
                <span className="rounded-full bg-[#1e4d42] px-3 py-1 text-xs font-medium text-[#f6f1e8]">
                  Active
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["128", "Properties"],
                  ["86", "Sent"],
                  ["18%", "Replies"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-[#f6f0e4] px-3 py-3"
                  >
                    <p className="font-display text-2xl text-[#1a1814]">{value}</p>
                    <p className="text-[11px] uppercase tracking-wider text-[#7a7066]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {deskRows.map((row, index) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-2xl border border-[#efe4d4] bg-white px-3 py-3 transition-transform duration-300 hover:-translate-y-0.5"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1a1814]">{row.name}</p>
                      <p className="text-xs text-[#7a7066]">{row.meta}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        row.tone === "Replied"
                          ? "bg-[#e7f2ec] text-[#1e4d42]"
                          : row.tone === "Sent"
                          ? "bg-[#f8efe4] text-[#8a5a2b]"
                          : "bg-[#f3efe8] text-[#6b6156]"
                      }`}
                    >
                      {row.tone}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 border-y border-[#eadfce] bg-[#fffaf4]/70">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8a6a45]">
              Workflow
            </p>
            <h2 className="mt-2 font-display text-3xl text-[#1a1814] sm:text-4xl">
              {featuresContent.title}
            </h2>
            <p className="mt-3 text-[#5c5348]">{featuresContent.description}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="group rounded-[24px] border border-[#eadfce] bg-white/80 p-6 shadow-studio transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1c3a32] text-[#f6efe4] transition-transform duration-300 group-hover:scale-105">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <span className="font-display text-3xl text-[#e4d3bc]">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="font-display text-2xl text-[#1a1814]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5c5348]">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] bg-[#13241f] px-6 py-12 text-[#f6f1e8] sm:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-[#d4a574]">
                Ready when you are
              </p>
              <h2 className="mt-3 font-display text-4xl leading-tight">
                {ctaContent.title}
              </h2>
              <p className="mt-4 max-w-xl text-[#d7cfc2]">
                {ctaContent.description}
              </p>
            </div>
            <div className="flex lg:justify-end">
              <Link
                href={ctaContent.cta.href}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 rounded-full bg-[#f6efe4] px-7 text-base text-[#1c3a32] hover:bg-white"
                )}
              >
                {ctaContent.cta.text}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#eadfce]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div>
            <Logo size="md" showText clickable={false} />
            <p className="mt-4 max-w-sm text-sm text-[#6b6156]">
              Total Body Mobile Massage outreach team. Built for people who
              send the next email, not another spreadsheet.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <a
              href="mailto:tbmoutreach@gmail.com"
              className="flex items-center gap-2 text-[#1e4d42] transition-colors hover:text-[#13241f]"
            >
              <Mail className="h-4 w-4" />
              tbmoutreach@gmail.com
            </a>
            <a
              href="https://totalbodymobilemassage.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#1e4d42] transition-colors hover:text-[#13241f]"
            >
              <Globe className="h-4 w-4" />
              totalbodymobilemassage.com
            </a>
            <p className="pt-2 text-xs text-[#8a8176]">
              © 2026 RealEstate OutReach
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
