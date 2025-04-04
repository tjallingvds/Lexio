import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      
      // Save authentication data
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      toast.success('Account created successfully');
      navigate('/home');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto flex h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img 
            src="https://i.postimg.cc/ZRYSDm6t/Screenshot-2025-04-03-at-22-09-56.png" 
            alt="LexioLabs Logo" 
            className="mx-auto h-16 mb-2"
          />
        </div>
        
        <Card className="overflow-hidden p-0">
          <CardContent>
            <form className="p-6 md:p-8" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col items-center text-center w-full">
                  <h1 className="text-2xl font-bold">Sign Up</h1>
                  <p className="text-muted-foreground text-balance">
                    Create your LexioLabs account
                  </p>
                </div>
                
                <div className="grid gap-3 w-full">
                  <Label htmlFor="name" className="text-left">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="grid gap-3 w-full">
                  <Label htmlFor="email" className="text-left">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="grid gap-3 w-full">
                  <Label htmlFor="password" className="text-left">Password</Label>
                  <Input 
                    id="password" 
                    name="password"
                    type="password" 
                    required 
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="grid gap-3 w-full">
                  <Label htmlFor="confirmPassword" className="text-left">Confirm Password</Label>
                  <Input 
                    id="confirmPassword" 
                    name="confirmPassword"
                    type="password" 
                    required 
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                
                <div className="text-center text-sm w-full">
                  Already have an account?{" "}
                  <Link to="/login" className="underline underline-offset-4">
                    Log in
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        
        <div className="text-muted-foreground *:[a]:hover:text-primary mt-4 text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
          By signing up, you agree to our <a href="#">Terms of Service</a>{" "}
          and <a href="#">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
} 