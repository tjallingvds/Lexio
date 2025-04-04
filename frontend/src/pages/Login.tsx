import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginForm } from '@/components/login-form';
import { toast } from 'sonner';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleSubmit = async (email: string, password: string) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      
      // Save authentication data
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      toast.success('Login successful');
      navigate('/home');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
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
        <LoginForm 
          onSubmit={handleSubmit} 
          loading={loading} 
          registerLink={<Link to="/register">Sign up</Link>}
        />
      </div>
    </div>
  );
} 