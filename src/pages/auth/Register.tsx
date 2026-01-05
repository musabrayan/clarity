import { useActionState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { register } from "@/actions/auth.api";
import type { ApiErrorResponse, UserRole } from "@/types/auth";

const Register = () => {
  const navigate = useNavigate();

  const [error, registerAction, isPending] = useActionState(
    async (_prevState: string | null, formData: FormData) => {
      const username = formData.get("username") as string;
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const password2 = formData.get("password2") as string;
      const role = formData.get("role") as string;

      if (!username || !email || !password || !password2 || !role) {
        toast.error("Please fill in all fields");
        return "Please fill in all fields";
      }

      if (password !== password2) {
        toast.error("Passwords do not match");
        return "Passwords do not match";
      }

      try {
        const data = await register({ 
          username, 
          email, 
          password, 
          password2, 
          role: role as UserRole 
        });

        if (!data.success) {
          const errorData = data as ApiErrorResponse;
          let errorMessage = "Registration failed. Please try again.";
          
          if (typeof errorData.error === "string") {
            errorMessage = errorData.error;
          } else if (typeof errorData.error === "object") {
            const errors = Object.values(errorData.error)
              .flat()
              .join(", ");
            errorMessage = errors || errorMessage;
          }
          
          toast.error(errorMessage);
          return errorMessage;
        }

        toast.success("Registration successful! Please login.");
        navigate("/login");
        return null;
      } catch (error) {
        console.error("Registration error:", error);
        toast.error("An error occurred. Please try again.");
        return "An error occurred. Please try again.";
      }
    },
    null
  );

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Create your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Fill in your details to get started
          </p>
        </div>

        <form action={registerAction} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                disabled={isPending}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                disabled={isPending}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                disabled={isPending}
                required
              />
            </div>

            <div>
              <label htmlFor="password2" className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <Input
                id="password2"
                name="password2"
                type="password"
                placeholder="Confirm your password"
                disabled={isPending}
                required
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium mb-2">
                Role
              </label>
              <Select name="role" disabled={isPending} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Creating account...
              </>
            ) : (
              "Sign up"
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-primary hover:underline"
              onClick={(e) => {
                e.preventDefault();
                navigate("/login");
              }}
            >
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
