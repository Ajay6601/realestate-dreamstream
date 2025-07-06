"use client";

import { homeController } from "@/lib/controllers/home-controller";

export function useHomeController() {
  const features = homeController.getFeatures();
  const heroContent = homeController.getHeroContent();
  const featuresContent = homeController.getFeaturesSectionContent();
  const ctaContent = homeController.getCtaContent();

  return {
    features,
    heroContent,
    featuresContent,
    ctaContent,
  };
}
