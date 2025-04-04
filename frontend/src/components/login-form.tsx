import { useState, FormEvent } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LoginFormProps {
  className?: string;
  onSubmit?: (email: string, password: string) => void;
  loading?: boolean;
  registerLink?: React.ReactNode;
}

export function LoginForm({
  className,
  onSubmit,
  loading = false,
  registerLink,
  ...props
}: LoginFormProps & Omit<React.HTMLAttributes<HTMLDivElement>, 'onSubmit'>) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(email, password);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent>
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6 w-full">
              <div className="flex flex-col items-center text-center w-full">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-balance">
                  Login to your LexioLabs account
                </p>
              </div>
              <div className="grid gap-3 w-full">
                <Label htmlFor="email" className="text-left">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-3 w-full">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-left">Password</Label>
                  <a
                    href="#"
                    className="text-sm underline-offset-2 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
              <div className="text-center text-sm w-full">
                Don&apos;t have an account?{" "}
                {registerLink || (
                  <a href="#" className="underline underline-offset-4">
                    Sign up
                  </a>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </div>
    </div>
  )
}
