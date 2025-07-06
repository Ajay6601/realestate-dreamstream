import { LucideIcon, Upload, Mail, FileText, BarChart3 } from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export class HomeController {
  private readonly features: Feature[] = [
    {
      icon: BarChart3,
      title: "Dashboard & Email Logs",
      description:
        "View comprehensive dashboard with analytics and monitor all email activities and logs.",
    },
    {
      icon: Upload,
      title: "Extract Property Names",
      description:
        "Upload property photos and extract names using Gemini AI to find property information automatically.",
    },
    {
      icon: Mail,
      title: "CRUD Email Templates",
      description:
        "Create, edit, and manage email templates that can be sent to all property managers.",
    },
    {
      icon: FileText,
      title: "Amenity Proposals",
      description:
        "Select and send amenity proposals to property managers who reply to your outreach emails.",
    },
  ];

  public getFeatures(): Feature[] {
    return this.features;
  }

  public getHeroContent() {
    return {
      title: {
        main: "Real Estate",
        accent: "Outreach Automation",
      },
      description:
        "Automate your property manager outreach with AI-powered tools. Extract data, manage templates, send proposals, and track results.",
    };
  }

  public getFeaturesSectionContent() {
    return {
      title: "Powerful Automation Features",
      description:
        "Everything you need to streamline your real estate outreach process with n8n workflows",
    };
  }

  public getCtaContent() {
    return {
      title: "Ready to Start?",
      description:
        "Automated email sending powered by n8n workflows. Contact your administrator for access to the platform.",
      cta: {
        text: "Login to Your Account",
        href: "/login",
      },
    };
  }
}

export const homeController = new HomeController();
