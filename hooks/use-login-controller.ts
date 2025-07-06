"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  loginController,
  LoginFormData,
} from "@/lib/controllers/login-controller";

export function useLoginController() {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const pageContent = loginController.getPageContent();

  const updateFormField = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await loginController.signIn(formData);

      if (error) {
        const message = loginController.getErrorMessage(error);
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        // Navigate to dashboard on successful login, immediately
        window.location.href = "/dashboard";
        return;
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return {
    formData,
    showPassword,
    isLoading,
    pageContent,
    updateFormField,
    togglePasswordVisibility,
    handleLogin,
  };
}
