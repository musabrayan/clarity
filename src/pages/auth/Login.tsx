import { useActionState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { login } from "@/actions/auth.api";
import { setAuth } from "@/redux/authSlice";
import type { ApiErrorResponse } from "@/types/auth";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [error, loginAction, isPending] = useActionState(
    async (_prevState: string | null, formData: FormData) => {
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;

      if (!username || !password) {
        toast.error("Please fill in all fields");
        return "Please fill in all fields";
      }

      try {
        const data = await login({ username, password });

        if (!data.success) {
          const errorData = data as ApiErrorResponse;
          const errorMessage = typeof errorData.error === "string" 
            ? errorData.error 
            : "Login failed. Please try again.";
          toast.error(errorMessage);
          return errorMessage;
        }

        toast.success("Login successful!");
        // Dispatch all auth data to Redux (automatically syncs to localStorage)
        dispatch(setAuth({
          user: data.data.user,
          accessToken: data.data.tokens.access,
          refreshToken: data.data.tokens.refresh,
        }));
        // Redirect based on user role
        const role = data.data.user.role;
        if (role === 'USER') {
          navigate("/user/dashboard");
        } else if (role === 'AGENT') {
          navigate("/agent/dashboard");
        }
        return null;
      } catch (error) {
        console.error("Login error:", error);
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
          <h2 className="text-3xl font-bold tracking-tight">Sign in to your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>

        <form action={loginAction} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
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
                placeholder="Enter your password"
                disabled={isPending}
                required
              />
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
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;