import { createClient } from "@/lib/supabase/client";

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginPageContent {
  title: string;
  subtitle: string;
  card: {
    title: string;
    description: string;
  };
  form: {
    emailLabel: string;
    passwordLabel: string;
    submitButton: {
      idle: string;
    };
  };
}

export class LoginController {
  private supabase = createClient();

  private readonly pageContent: LoginPageContent = {
    title: "Sign in to your account",
    subtitle: "Access your dashboard and manage your properties.",
    card: {
      title: "Login",
      description: "Enter your email and password to access your account",
    },
    form: {
      emailLabel: "Email address",
      passwordLabel: "Password",
      submitButton: {
        idle: "Sign in",
      },
    },
  };

  public getPageContent(): LoginPageContent {
    return this.pageContent;
  }

  public async signIn(formData: LoginFormData) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });

      return { data, error };
    } catch (error) {
      return {
        data: null,
        error: {
          message: "Network error. Please check your connection and try again.",
        },
      };
    }
  }

  public getErrorMessage(error: any): string {
    // Return the actual error message from Supabase, or a fallback
    return error?.message || "An unexpected error occurred. Please try again.";
  }
}

export const loginController = new LoginController();
